import { db } from '@/db';
import { organizations, profiles, mealSlots, mealConfirmations, recurringPreferences, invoices, billingSnapshots } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { resend } from '../lib/resend';

export class BillingService {
  /**
   * Generates a monthly invoice draft for an organization based on meals consumed.
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

    // 4. Fetch all explicit confirmations in the period
    const confirmations = await db
      .select()
      .from(mealConfirmations)
      .where(
        and(
          sql`${mealConfirmations.date} >= ${startDateStr}`,
          sql`${mealConfirmations.date} <= ${endDateStr}`
        )
      );

    // 5. Fetch recurring preferences for all members
    const recurringPrefs = await db
      .select()
      .from(recurringPreferences);

    let totalMealsCount = 0;
    let totalAmount = 0;

    // Track quantity consumed per meal slot ID
    const slotQuantities = new Map<string, number>();
    for (const slot of slots) {
      slotQuantities.set(slot.id, 0);
    }

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    // For each member, iterate over each date in the period to compute confirmations
    for (const member of members) {
      const memberPrefs = recurringPrefs.filter((p) => p.memberId === member.id);
      const memberConfirmations = confirmations.filter((c) => c.memberId === member.id);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = d.getDay();

        for (const slot of slots) {
          const explicitConf = memberConfirmations.find((c) => c.mealSlotId === slot.id && c.date === dateStr);
          let isConfirmed = false;
          let quantity = 1;

          if (explicitConf) {
            isConfirmed = explicitConf.status === 'confirmed';
            quantity = explicitConf.quantity;
          } else if (member.mealBehaviorType === 'recurring') {
            // Check recurring pref default
            const pref = memberPrefs.find((p) => p.mealSlotId === slot.id && p.dayOfWeek === dayOfWeek);
            if (pref) {
              isConfirmed = true;
              quantity = pref.quantity;
            }
          }

          if (isConfirmed) {
            totalMealsCount += quantity;
            totalAmount += parseFloat(slot.price) * quantity;

            const currentQty = slotQuantities.get(slot.id) || 0;
            slotQuantities.set(slot.id, currentQty + quantity);
          }
        }
      }
    }

    // 6. Save draft invoice to DB
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

    // 7. Save billing snapshots to DB
    const snapshotsToInsert = [];
    for (const slot of slots) {
      const quantity = slotQuantities.get(slot.id) || 0;
      if (quantity > 0) {
        const unitPrice = parseFloat(slot.price);
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
        
        <p>Please log in to your catering portal to approve and settle payment via credit card or bank transfer.</p>
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
