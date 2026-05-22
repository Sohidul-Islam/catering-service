import { db } from '@/db';
import { mealSlots, mealConfirmations, mealAdjustmentLogs, profiles, recurringPreferences } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export class MealService {
  /**
   * Helper to check if the deadline has passed for a given slot and meal date.
   */
  isPastDeadline(slot: { confirmationDeadline: string; deadlineDaysAhead: number }, mealDateStr: string) {
    // Current date and time in the organization's timezone
    const now = new Date();
    
    // Construct the deadline date
    const mealDate = new Date(mealDateStr);
    mealDate.setDate(mealDate.getDate() - slot.deadlineDaysAhead);
    
    const [hours, minutes] = slot.confirmationDeadline.split(':').map(Number);
    mealDate.setHours(hours, minutes, 0, 0);
    
    return now.getTime() > mealDate.getTime();
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

    // Enforce Cutoff rules
    if (this.isPastDeadline(slot, date)) {
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
        .set({ status, quantity, updatedAt: new Date() })
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
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

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
            isDeadlinePassed: this.isPastDeadline(slot, dateStr),
          });
        } else {
          // If no confirmation exists but they are a recurring member with a preference for this day/slot
          const pref = preferences.find((p) => p.mealSlotId === slot.id && p.dayOfWeek === dayOfWeek);
          const isDeadlinePassed = this.isPastDeadline(slot, dateStr);

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
    }

    return result;
  }
}

export const mealService = new MealService();
