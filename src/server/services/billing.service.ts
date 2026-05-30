import { db } from '@/db';
import { organizations, profiles, mealSlots, mealConfirmations, recurringPreferences, invoices, billingSnapshots, holidays, memberLeaves } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { resend } from '../lib/resend';

export class BillingService {
  /**
   * Generates a monthly invoice draft for an organization based on meals consumed.
   * Respects:
   * - Organization holidays (skipped days)
   * - Member joined_at / left_at date ranges (only bill active members per day)
   * - Historical booking prices over current slot prices
   */
  async generateInvoice(organizationId: string, startDateStr: string, endDateStr: string) {
    // 1. Fetch organization details
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
    if (!org) throw new Error('Organization not found');

    // 2. Fetch all members in this organization
    const members = await db.select().from(profiles).where(eq(profiles.organizationId, organizationId));
    if (members.length === 0) {
      throw new Error('This organization has no registered members.');
    }

    // 3. Fetch all active meal slots
    const slots = await db.select().from(mealSlots).where(eq(mealSlots.organizationId, organizationId));

    // Fetch organization holidays within billing period
    const orgHolidays = await db
      .select()
      .from(holidays)
      .where(
        and(
          eq(holidays.organizationId, organizationId),
          sql`${holidays.date} >= ${startDateStr}`,
          sql`${holidays.date} <= ${endDateStr}`
        )
      );
    const holidayDates = new Set(orgHolidays.map(h => h.date));

    // 5b. Fetch all member leaves within billing period for this organization
    const orgMemberLeaves = await db
      .select()
      .from(memberLeaves)
      .where(
        and(
          eq(memberLeaves.organizationId, organizationId),
          sql`${memberLeaves.endDate} >= ${startDateStr}`,
          sql`${memberLeaves.startDate} <= ${endDateStr}`
        )
      );
    // Build a per-member set of leave dates for O(1) lookup
    const memberLeaveDates = new Map<string, Set<string>>();
    for (const leave of orgMemberLeaves) {
      if (!memberLeaveDates.has(leave.memberId)) {
        memberLeaveDates.set(leave.memberId, new Set());
      }
      let cur = new Date(leave.startDate + 'T00:00:00Z');
      const leaveEnd = new Date(leave.endDate + 'T00:00:00Z');
      while (cur <= leaveEnd) {
        memberLeaveDates.get(leave.memberId)!.add(cur.toISOString().split('T')[0]);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    // 5. Fetch all explicit confirmations in the period FOR THIS ORGANIZATION ONLY
    const confirmations = await db
      .select({
        id: mealConfirmations.id,
        memberId: mealConfirmations.memberId,
        mealSlotId: mealConfirmations.mealSlotId,
        date: mealConfirmations.date,
        status: mealConfirmations.status,
        quantity: mealConfirmations.quantity,
        price: mealConfirmations.price,
        isOverridden: mealConfirmations.isOverridden,
        overriddenById: mealConfirmations.overriddenById,
        createdAt: mealConfirmations.createdAt,
        updatedAt: mealConfirmations.updatedAt,
      })
      .from(mealConfirmations)
      .innerJoin(profiles, eq(mealConfirmations.memberId, profiles.id))
      .where(
        and(
          eq(profiles.organizationId, organizationId),
          sql`${mealConfirmations.date} >= ${startDateStr}`,
          sql`${mealConfirmations.date} <= ${endDateStr}`
        )
      );

    // 6. Fetch recurring preferences for all organization members
    const recurringPrefs = await db
      .select({
        id: recurringPreferences.id,
        memberId: recurringPreferences.memberId,
        mealSlotId: recurringPreferences.mealSlotId,
        dayOfWeek: recurringPreferences.dayOfWeek,
        quantity: recurringPreferences.quantity,
      })
      .from(recurringPreferences)
      .innerJoin(profiles, eq(recurringPreferences.memberId, profiles.id))
      .where(eq(profiles.organizationId, organizationId));

    let totalMealsCount = 0;
    let totalAmount = 0;

    // Track quantity consumed per meal slot ID
    const slotQuantities = new Map<string, number>();
    const slotPrices = new Map<string, number>();
    for (const slot of slots) {
      slotQuantities.set(slot.id, 0);
      slotPrices.set(slot.id, parseFloat(slot.price));
    }

    // For each member, iterate over each date in the period
    for (const member of members) {
      const memberPrefs = recurringPrefs.filter((p) => p.memberId === member.id);
      const memberConfirmations = confirmations.filter((c) => c.memberId === member.id);

      // Determine member's active billing window
      const memberJoinedAt = member.joinedAt ? member.joinedAt.toISOString().split('T')[0] : startDateStr;
      const memberLeftAt = member.leftAt ? member.leftAt.toISOString().split('T')[0] : null;

      // UTC-safe date loop
      let current = new Date(startDateStr + 'T00:00:00Z');
      const last = new Date(endDateStr + 'T00:00:00Z');

      while (current <= last) {
        const dateStr = current.toISOString().split('T')[0];
        const dayOfWeek = current.getUTCDay();

        // Skip organization holidays
        if (holidayDates.has(dateStr)) {
          current.setUTCDate(current.getUTCDate() + 1);
          continue;
        }

        // Skip dates before member joined or after member left
        if (dateStr < memberJoinedAt) {
          current.setUTCDate(current.getUTCDate() + 1);
          continue;
        }
        if (memberLeftAt && dateStr > memberLeftAt) {
          current.setUTCDate(current.getUTCDate() + 1);
          continue;
        }

        // Skip dates where the member is on approved leave
        const memberLeaveSet = memberLeaveDates.get(member.id);
        if (memberLeaveSet && memberLeaveSet.has(dateStr)) {
          current.setUTCDate(current.getUTCDate() + 1);
          continue;
        }

        for (const slot of slots) {
          const explicitConf = memberConfirmations.find((c) => c.mealSlotId === slot.id && c.date === dateStr);
          let isConfirmed = false;
          let quantity = 1;
          let activePrice = parseFloat(slot.price);

          if (explicitConf) {
            isConfirmed = explicitConf.status === 'confirmed';
            quantity = explicitConf.quantity;
            // Use historical booking price if available
            if (explicitConf.price) {
              activePrice = parseFloat(explicitConf.price);
            }
          } else if (member.mealBehaviorType === 'recurring') {
            const pref = memberPrefs.find((p) => p.mealSlotId === slot.id && p.dayOfWeek === dayOfWeek);
            if (pref) {
              isConfirmed = true;
              quantity = pref.quantity;
            }
          }

          if (isConfirmed) {
            totalMealsCount += quantity;
            totalAmount += activePrice * quantity;

            const currentQty = slotQuantities.get(slot.id) || 0;
            slotQuantities.set(slot.id, currentQty + quantity);
            slotPrices.set(slot.id, activePrice);
          }
        }

        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    // 7. Save draft invoice to DB
    const [invoice] = await db
      .insert(invoices)
      .values({
        organizationId,
        billingPeriodStart: startDateStr,
        billingPeriodEnd: endDateStr,
        totalMealsCount,
        totalAmount: totalAmount.toFixed(2),
        status: 'draft',
      })
      .returning();

    // 8. Save billing snapshots to DB
    const snapshotsToInsert = [];
    for (const slot of slots) {
      const quantity = slotQuantities.get(slot.id) || 0;
      if (quantity > 0) {
        const unitPrice = slotPrices.get(slot.id) || parseFloat(slot.price);
        snapshotsToInsert.push({
          invoiceId: invoice.id,
          mealSlotId: slot.id,
          slotName: slot.name,
          unitPrice: unitPrice.toFixed(2),
          totalQuantity: quantity,
          totalAmount: (unitPrice * quantity).toFixed(2),
        });
      }
    }

    if (snapshotsToInsert.length > 0) {
      await db.insert(billingSnapshots).values(snapshotsToInsert);
    }

    return invoice;
  }

  /**
   * Emails the invoice to the organization's billing email.
   */
  async sendInvoiceEmail(invoiceId: string) {
    const [invoiceRecord] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoiceRecord) throw new Error('Invoice not found');

    const [org] = await db.select().from(organizations).where(eq(organizations.id, invoiceRecord.organizationId));
    if (!org) throw new Error('Organization not found');

    const emailSubject = `Corporate Catering Monthly Invoice: ${org.name}`;
    const emailBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #6366f1;">LuxeCater Corporate Invoicing</h2>
        <p>Dear Administrator,</p>
        <p>Your monthly catering billing report has been compiled for the organization <strong>${org.name}</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f8fafc;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Billing Period</th>
            <td style="padding: 10px; border: 1px solid #ddd;">${invoiceRecord.billingPeriodStart} to ${invoiceRecord.billingPeriodEnd}</td>
          </tr>
          <tr>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Total Meals Consumed</th>
            <td style="padding: 10px; border: 1px solid #ddd;">${invoiceRecord.totalMealsCount} meals</td>
          </tr>
          <tr style="background: #f8fafc; font-weight: bold; font-size: 1.1em;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Total Amount Due</th>
            <td style="padding: 10px; border: 1px solid #ddd; color: #f43f5e;">$${invoiceRecord.totalAmount}</td>
          </tr>
        </table>
        
        <p>Please log in to your catering portal to approve and settle payment.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;" />
        <p style="font-size: 0.8em; color: #888;">This is an automated operational invoice from LuxeCater Meal Management SaaS.</p>
      </div>
    `;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: org.billingEmail,
      subject: emailSubject,
      html: emailBody,
    });

    await db
      .update(invoices)
      .set({ status: 'sent', updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId));

    return { success: true };
  }
}

export const billingService = new BillingService();
