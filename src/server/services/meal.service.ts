import { db } from '@/db';
import { mealSlots, mealConfirmations, mealAdjustmentLogs, profiles, recurringPreferences, organizations } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export class MealService {
  /**
   * Helper to check if the deadline has passed for a given slot and meal date.
   */
  isPastDeadline(slot: { confirmationDeadline: string; deadlineDaysAhead: number }, mealDateStr: string, timezone: string = 'UTC') {
    // 1. Calculate the deadline date string in YYYY-MM-DD (safely in UTC to avoid local timezone shifts)
    const d = new Date(mealDateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - slot.deadlineDaysAhead);
    const deadlineDateStr = d.toISOString().split('T')[0];
    
    // 2. Format deadline as ISO date time string: YYYY-MM-DDTHH:MM
    const deadlineDateTimeStr = `${deadlineDateStr}T${slot.confirmationDeadline}`;
    
    // 3. Get the current date and time in the organization's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    
    const orgNowStr = `${year}-${month}-${day}T${hour}:${minute}`;
    
    return orgNowStr > deadlineDateTimeStr;
  }

  /**
   * Confirm or skip a meal for an organization member, enforcing cutoff times.
   */
  async submitConfirmation(params: {
    memberId: string;
    mealSlotId: string;
    date: string; // YYYY-MM-DD
    status: 'confirmed' | 'skipped';
    quantity: number;
  }) {
    const { memberId, mealSlotId, date, status, quantity } = params;

    // Fetch member and slot configuration
    const [member] = await db.select().from(profiles).where(eq(profiles.id, memberId));
    if (!member) throw new Error('Member not found');
    if (!member.organizationId) throw new Error('Member is not associated with an organization');

    const [slot] = await db
      .select()
      .from(mealSlots)
      .where(and(eq(mealSlots.id, mealSlotId), eq(mealSlots.organizationId, member.organizationId)));
    if (!slot) throw new Error('Meal slot not found');

    const [org] = await db.select().from(organizations).where(eq(organizations.id, member.organizationId));
    const timezone = org?.timezone || 'UTC';

    // Enforce Cutoff rules
    if (this.isPastDeadline(slot, date, timezone)) {
      throw new Error(`The deadline for confirming this ${slot.name} slot has already passed.`);
    }

    // Insert or update confirmation
    const existing = await db
      .select()
      .from(mealConfirmations)
      .where(and(eq(mealConfirmations.memberId, memberId), eq(mealConfirmations.mealSlotId, mealSlotId), eq(mealConfirmations.date, date)));

    if (existing.length > 0) {
      const [updated] = await db
        .update(mealConfirmations)
        .set({ status, quantity, price: slot.price, updatedAt: new Date() })
        .where(eq(mealConfirmations.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(mealConfirmations)
        .values({
          memberId,
          mealSlotId,
          date,
          status,
          quantity,
          price: slot.price,
        })
        .returning();
      return created;
    }
  }

  /**
   * Force update confirmation on behalf of a member (Org Admin override), logging the audit log.
   */
  async adminOverride(params: {
    performedById: string;
    memberId: string;
    mealSlotId: string;
    date: string;
    status: 'confirmed' | 'skipped';
    quantity: number;
    reason?: string;
  }) {
    const { performedById, memberId, mealSlotId, date, status, quantity, reason } = params;

    // Fetch performer, member, and slot details
    const [performer] = await db.select().from(profiles).where(eq(profiles.id, performedById));
    const [member] = await db.select().from(profiles).where(eq(profiles.id, memberId));
    if (!performer || performer.role !== 'org_admin') {
      throw new Error('Only organization administrators can override meal statuses.');
    }
    if (!member || member.organizationId !== performer.organizationId) {
      throw new Error('Member belongs to a different organization.');
    }

    const [slot] = await db.select().from(mealSlots).where(eq(mealSlots.id, mealSlotId));
    if (!slot || slot.organizationId !== performer.organizationId) {
      throw new Error('Meal slot not found or access denied.');
    }

    // Perform override without checking cutoff (override is allowed after cutoff)
    const existing = await db
      .select()
      .from(mealConfirmations)
      .where(and(eq(mealConfirmations.memberId, memberId), eq(mealConfirmations.mealSlotId, mealSlotId), eq(mealConfirmations.date, date)));

    let confirmationRecord;
    if (existing.length > 0) {
      [confirmationRecord] = await db
        .update(mealConfirmations)
        .set({
          status,
          quantity,
          price: slot.price,
          isOverridden: true,
          overriddenById: performedById,
          updatedAt: new Date(),
        })
        .where(eq(mealConfirmations.id, existing[0].id))
        .returning();
    } else {
      [confirmationRecord] = await db
        .insert(mealConfirmations)
        .values({
          memberId,
          mealSlotId,
          date,
          status,
          quantity,
          price: slot.price,
          isOverridden: true,
          overriddenById: performedById,
        })
        .returning();
    }

    // Log the adjustment
    await db.insert(mealAdjustmentLogs).values({
      organizationId: performer.organizationId,
      performedById,
      memberId,
      mealSlotId,
      date,
      actionType: status === 'confirmed' ? 'override_confirm' : 'override_skip',
      details: reason || `Overridden to ${status} (qty: ${quantity}) by Admin ${performer.fullName || performer.email}`,
    });

    return confirmationRecord;
  }

  /**
   * Syncs/returns a member's daily RSVP list for a target range of dates.
   * If a member is a "recurring" type, and has a recurring opt-in for a slot/day of week,
   * we automatically initialize their confirmation record as 'confirmed' if it is not yet defined.
   */
  async getMemberConfirmationsForRange(memberId: string, startDateStr: string, endDateStr: string) {
    const [member] = await db.select().from(profiles).where(eq(profiles.id, memberId));
    if (!member || !member.organizationId) return [];

    // Fetch the organization timezone
    const [org] = await db.select().from(organizations).where(eq(organizations.id, member.organizationId));
    const timezone = org?.timezone || 'UTC';

    // Get active slots for this organization
    const slots = await db
      .select()
      .from(mealSlots)
      .where(and(eq(mealSlots.organizationId, member.organizationId), eq(mealSlots.isActive, true)));

    // Get existing confirmations
    const confirmations = await db
      .select()
      .from(mealConfirmations)
      .where(and(eq(mealConfirmations.memberId, memberId), sql`${mealConfirmations.date} >= ${startDateStr}`, sql`${mealConfirmations.date} <= ${endDateStr}`));

    // If member is recurring, get their weekly recurring preferences
    const preferences = member.mealBehaviorType === 'recurring'
      ? await db.select().from(recurringPreferences).where(eq(recurringPreferences.memberId, memberId))
      : [];

    const result = [];
    let current = new Date(startDateStr + 'T00:00:00Z');
    const last = new Date(endDateStr + 'T00:00:00Z');

    while (current <= last) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.

      for (const slot of slots) {
        // Find existing confirmation
        const found = confirmations.find((c) => c.mealSlotId === slot.id && c.date === dateStr);

        if (found) {
          result.push({
            slot,
            date: dateStr,
            status: found.status,
            quantity: found.quantity,
            isOverridden: found.isOverridden,
            confirmationId: found.id,
            isDeadlinePassed: this.isPastDeadline(slot, dateStr, timezone),
          });
        } else {
          // If no confirmation exists but they are a recurring member with a preference for this day/slot
          const pref = preferences.find((p) => p.mealSlotId === slot.id && p.dayOfWeek === dayOfWeek);
          const isDeadlinePassed = this.isPastDeadline(slot, dateStr, timezone);

          result.push({
            slot,
            date: dateStr,
            status: pref ? 'confirmed' : 'pending',
            quantity: pref ? pref.quantity : 1,
            isOverridden: false,
            confirmationId: null,
            isDeadlinePassed,
          });
        }
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return result;
  }
}

export const mealService = new MealService();
