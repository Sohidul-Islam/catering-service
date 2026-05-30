import { router, superAdminProcedure, orgAdminProcedure, orgMemberProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '@/db';
import {
  organizations, profiles, mealSlots, recurringPreferences, mealConfirmations,
  invoices, mealAdjustmentLogs, holidays, departments, officeLocations,
  billingAdjustments, memberLeaves,
} from '@/db/schema';
import { desc, eq, and, sql, asc } from 'drizzle-orm';
import { mealService } from '../services/meal.service';
import { billingService } from '../services/billing.service';

// ─────────────────────────────────────────────────────────────────────────────
// ORGANIZATION ROUTER
// ─────────────────────────────────────────────────────────────────────────────
export const organizationRouter = router({
  create: superAdminProcedure
    .input(z.object({
      name: z.string().min(1),
      billingEmail: z.string().email(),
      timezone: z.string().default('UTC'),
      logoUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [org] = await db.insert(organizations).values(input).returning();
      return org;
    }),

  getAll: superAdminProcedure.query(async () => {
    return await db.select().from(organizations).orderBy(desc(organizations.createdAt));
  }),

  getDetails: orgMemberProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId;
    if (!orgId) throw new Error('Access denied: no organization linked.');
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    return org;
  }),

  updateSettings: orgAdminProcedure
    .input(z.object({
      name: z.string().min(1),
      billingEmail: z.string().email(),
      timezone: z.string().default('UTC'),
      logoUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [updated] = await db
        .update(organizations)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(organizations.id, orgId))
        .returning();
      return updated;
    }),

  // ── Member Management ────────────────────────────────────────────────────
  getMembers: orgAdminProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.organizationId, orgId), eq(profiles.isActive, true)))
      .orderBy(desc(profiles.createdAt));
  }),

  addMember: orgAdminProcedure
    .input(z.object({
      id: z.string(),
      email: z.string().email(),
      fullName: z.string().optional(),
      phoneNumber: z.string().optional(),
      role: z.enum(['org_admin', 'org_member']).default('org_member'),
      mealBehaviorType: z.enum(['recurring', 'flexible']).default('flexible'),
      departmentId: z.string().uuid().optional(),
      officeLocationId: z.string().uuid().optional(),
      joinedAt: z.string().optional(), // YYYY-MM-DD
    }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const { joinedAt, ...rest } = input;
      const [created] = await db.insert(profiles).values({
        ...rest,
        organizationId: orgId,
        joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
      }).returning();
      return created;
    }),

  deactivateMember: orgAdminProcedure
    .input(z.object({ memberId: z.string(), leftAt: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [updated] = await db
        .update(profiles)
        .set({ isActive: false, leftAt: input.leftAt ? new Date(input.leftAt) : new Date(), updatedAt: new Date() })
        .where(and(eq(profiles.id, input.memberId), eq(profiles.organizationId, orgId)))
        .returning();
      return updated;
    }),

  reactivateMember: orgAdminProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [updated] = await db
        .update(profiles)
        .set({ isActive: true, leftAt: null, updatedAt: new Date() })
        .where(and(eq(profiles.id, input.memberId), eq(profiles.organizationId, orgId)))
        .returning();
      return updated;
    }),

  toggleMemberBehavior: orgAdminProcedure
    .input(z.object({
      memberId: z.string(),
      mealBehaviorType: z.enum(['recurring', 'flexible']),
    }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [updated] = await db
        .update(profiles)
        .set({ mealBehaviorType: input.mealBehaviorType, updatedAt: new Date() })
        .where(and(eq(profiles.id, input.memberId), eq(profiles.organizationId, orgId)))
        .returning();
      return updated;
    }),

  // ── Meal Slot Management ─────────────────────────────────────────────────
  getSlots: orgMemberProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db.select().from(mealSlots).where(eq(mealSlots.organizationId, orgId)).orderBy(mealSlots.startTime);
  }),

  createSlot: orgAdminProcedure
    .input(z.object({
      name: z.string().min(1),
      startTime: z.string(),
      endTime: z.string(),
      confirmationDeadline: z.string(),
      deadlineDaysAhead: z.number().default(0),
      price: z.string(),
      capacity: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [slot] = await db.insert(mealSlots).values({ ...input, organizationId: orgId }).returning();
      return slot;
    }),

  updateSlot: orgAdminProcedure
    .input(z.object({
      slotId: z.string().uuid(),
      name: z.string().min(1).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      confirmationDeadline: z.string().optional(),
      deadlineDaysAhead: z.number().optional(),
      price: z.string().optional(),
      capacity: z.number().int().positive().nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const { slotId, ...fields } = input;
      const [updated] = await db
        .update(mealSlots)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(mealSlots.id, slotId), eq(mealSlots.organizationId, orgId)))
        .returning();
      return updated;
    }),

  // ── Holiday Management ───────────────────────────────────────────────────
  getHolidays: orgMemberProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db.select().from(holidays).where(eq(holidays.organizationId, orgId)).orderBy(asc(holidays.date));
  }),

  addHoliday: orgAdminProcedure
    .input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
      name: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [created] = await db.insert(holidays).values({ ...input, organizationId: orgId }).returning();
      return created;
    }),

  deleteHoliday: orgAdminProcedure
    .input(z.object({ holidayId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      await db.delete(holidays).where(and(eq(holidays.id, input.holidayId), eq(holidays.organizationId, orgId)));
      return { success: true };
    }),

  // ── Department Management ────────────────────────────────────────────────
  getDepartments: orgMemberProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db.select().from(departments).where(eq(departments.organizationId, orgId)).orderBy(asc(departments.name));
  }),

  addDepartment: orgAdminProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [created] = await db.insert(departments).values({ name: input.name, organizationId: orgId }).returning();
      return created;
    }),

  deleteDepartment: orgAdminProcedure
    .input(z.object({ departmentId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      await db.delete(departments).where(and(eq(departments.id, input.departmentId), eq(departments.organizationId, orgId)));
      return { success: true };
    }),

  // ── Office Location Management ───────────────────────────────────────────
  getOfficeLocations: orgMemberProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db.select().from(officeLocations).where(eq(officeLocations.organizationId, orgId)).orderBy(asc(officeLocations.name));
  }),

  addOfficeLocation: orgAdminProcedure
    .input(z.object({ name: z.string().min(1), address: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [created] = await db.insert(officeLocations).values({ ...input, organizationId: orgId }).returning();
      return created;
    }),

  deleteOfficeLocation: orgAdminProcedure
    .input(z.object({ locationId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      await db.delete(officeLocations).where(and(eq(officeLocations.id, input.locationId), eq(officeLocations.organizationId, orgId)));
      return { success: true };
    }),

  // ── Member Leave Management ──────────────────────────────────────────────
  getMemberLeaves: orgAdminProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db
      .select()
      .from(memberLeaves)
      .where(eq(memberLeaves.organizationId, orgId))
      .orderBy(desc(memberLeaves.startDate));
  }),

  getMyLeaves: orgMemberProcedure.query(async ({ ctx }) => {
    return await db
      .select()
      .from(memberLeaves)
      .where(eq(memberLeaves.memberId, ctx.dbUser!.id))
      .orderBy(desc(memberLeaves.startDate));
  }),

  addMemberLeave: orgAdminProcedure
    .input(z.object({
      memberId: z.string(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      // Verify member belongs to org
      const [member] = await db.select().from(profiles).where(and(eq(profiles.id, input.memberId), eq(profiles.organizationId, orgId)));
      if (!member) throw new Error('Member not found in this organization');
      const [created] = await db.insert(memberLeaves).values({ ...input, organizationId: orgId }).returning();
      return created;
    }),

  deleteMemberLeave: orgAdminProcedure
    .input(z.object({ leaveId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      await db.delete(memberLeaves).where(and(eq(memberLeaves.id, input.leaveId), eq(memberLeaves.organizationId, orgId)));
      return { success: true };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// MEAL ROUTER
// ─────────────────────────────────────────────────────────────────────────────
export const mealRouter = router({
  getConfirmations: orgMemberProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input, ctx }) => {
      return await mealService.getMemberConfirmationsForRange(ctx.dbUser!.id, input.startDate, input.endDate);
    }),

  confirmMeal: orgMemberProcedure
    .input(z.object({
      mealSlotId: z.string().uuid(),
      date: z.string(),
      status: z.enum(['confirmed', 'skipped']),
      quantity: z.number().min(1).default(1),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check capacity if slot has one
      if (input.status === 'confirmed') {
        const [slot] = await db.select().from(mealSlots).where(eq(mealSlots.id, input.mealSlotId));
        if (slot?.capacity) {
          const countResult = await db
            .select({ total: sql<number>`SUM(${mealConfirmations.quantity})` })
            .from(mealConfirmations)
            .where(and(
              eq(mealConfirmations.mealSlotId, input.mealSlotId),
              eq(mealConfirmations.date, input.date),
              eq(mealConfirmations.status, 'confirmed'),
            ));
          const currentTotal = Number(countResult[0]?.total ?? 0);
          if (currentTotal + input.quantity > slot.capacity) {
            throw new Error(`Capacity limit of ${slot.capacity} reached for this meal slot.`);
          }
        }
      }
      return await mealService.submitConfirmation({ memberId: ctx.dbUser!.id, ...input });
    }),

  saveRecurringPreferences: orgMemberProcedure
    .input(z.array(z.object({
      mealSlotId: z.string().uuid(),
      dayOfWeek: z.number().min(0).max(6),
      quantity: z.number().min(1).default(1),
    })))
    .mutation(async ({ input, ctx }) => {
      const memberId = ctx.dbUser!.id;
      await db.delete(recurringPreferences).where(eq(recurringPreferences.memberId, memberId));
      if (input.length === 0) return { success: true };
      await db.insert(recurringPreferences).values(input.map(p => ({ memberId, ...p })));
      return { success: true };
    }),

  getRecurringPreferences: orgMemberProcedure.query(async ({ ctx }) => {
    return await db.select().from(recurringPreferences).where(eq(recurringPreferences.memberId, ctx.dbUser!.id));
  }),

  adminOverride: orgAdminProcedure
    .input(z.object({
      memberId: z.string(),
      mealSlotId: z.string().uuid(),
      date: z.string(),
      status: z.enum(['confirmed', 'skipped']),
      quantity: z.number().min(1).default(1),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await mealService.adminOverride({ performedById: ctx.dbUser!.id, ...input });
    }),

  getDailyStats: orgAdminProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const slots = await db.select().from(mealSlots).where(and(eq(mealSlots.organizationId, orgId), eq(mealSlots.isActive, true)));
      const members = await db.select().from(profiles).where(and(eq(profiles.organizationId, orgId), eq(profiles.isActive, true)));

      const confirmations = await db
        .select({
          id: mealConfirmations.id,
          memberId: mealConfirmations.memberId,
          mealSlotId: mealConfirmations.mealSlotId,
          status: mealConfirmations.status,
          quantity: mealConfirmations.quantity,
        })
        .from(mealConfirmations)
        .innerJoin(profiles, eq(mealConfirmations.memberId, profiles.id))
        .where(and(eq(profiles.organizationId, orgId), eq(mealConfirmations.date, input.date)));

      const recurringPrefs = await db
        .select({ memberId: recurringPreferences.memberId, mealSlotId: recurringPreferences.mealSlotId, dayOfWeek: recurringPreferences.dayOfWeek, quantity: recurringPreferences.quantity })
        .from(recurringPreferences)
        .innerJoin(profiles, eq(recurringPreferences.memberId, profiles.id))
        .where(eq(profiles.organizationId, orgId));

      const dayOfWeek = new Date(input.date + 'T00:00:00Z').getUTCDay();

      return slots.map((slot) => {
        let confirmedCount = 0, skippedCount = 0, pendingCount = 0;
        for (const member of members) {
          const explicitConf = confirmations.find(c => c.memberId === member.id && c.mealSlotId === slot.id);
          if (explicitConf) {
            if (explicitConf.status === 'confirmed') confirmedCount += explicitConf.quantity;
            else skippedCount += 1;
          } else if (member.mealBehaviorType === 'recurring') {
            const pref = recurringPrefs.find(p => p.memberId === member.id && p.mealSlotId === slot.id && p.dayOfWeek === dayOfWeek);
            if (pref) confirmedCount += pref.quantity;
            else pendingCount += 1;
          } else {
            pendingCount += 1;
          }
        }
        return { slotId: slot.id, slotName: slot.name, time: `${slot.startTime} - ${slot.endTime}`, confirmedCount, skippedCount, pendingCount, price: slot.price, capacity: slot.capacity };
      });
    }),

  // Kitchen dashboard — unified view across ALL tenants (super admin only)
  getKitchenDashboard: superAdminProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ input }) => {
      const dayOfWeek = new Date(input.date + 'T00:00:00Z').getUTCDay();

      // Aggregate confirmed counts per slot per organization using SQL
      const explicitCounts = await db
        .select({
          orgId: profiles.organizationId,
          mealSlotId: mealConfirmations.mealSlotId,
          slotName: mealSlots.name,
          total: sql<number>`SUM(${mealConfirmations.quantity})`,
        })
        .from(mealConfirmations)
        .innerJoin(profiles, eq(mealConfirmations.memberId, profiles.id))
        .innerJoin(mealSlots, eq(mealConfirmations.mealSlotId, mealSlots.id))
        .where(and(eq(mealConfirmations.date, input.date), eq(mealConfirmations.status, 'confirmed')))
        .groupBy(profiles.organizationId, mealConfirmations.mealSlotId, mealSlots.name);

      // Recurring defaults for the day
      const recurringCounts = await db
        .select({
          orgId: profiles.organizationId,
          mealSlotId: recurringPreferences.mealSlotId,
          slotName: mealSlots.name,
          total: sql<number>`SUM(${recurringPreferences.quantity})`,
        })
        .from(recurringPreferences)
        .innerJoin(profiles, eq(recurringPreferences.memberId, profiles.id))
        .innerJoin(mealSlots, eq(recurringPreferences.mealSlotId, mealSlots.id))
        .where(and(eq(recurringPreferences.dayOfWeek, dayOfWeek), eq(profiles.mealBehaviorType, 'recurring')))
        .groupBy(profiles.organizationId, recurringPreferences.mealSlotId, mealSlots.name);

      return { explicitCounts, recurringCounts };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// BILLING ROUTER
// ─────────────────────────────────────────────────────────────────────────────
export const billingRouter = router({
  getInvoices: orgAdminProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db.select().from(invoices).where(eq(invoices.organizationId, orgId)).orderBy(desc(invoices.createdAt));
  }),

  generateInvoice: orgAdminProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      return await billingService.generateInvoice(orgId, input.startDate, input.endDate);
    }),

  sendInvoiceEmail: orgAdminProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return await billingService.sendInvoiceEmail(input.invoiceId);
    }),

  markAsPaid: orgAdminProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, orgId)));
      if (!invoice) throw new Error('Invoice not found or access denied');
      const [updated] = await db
        .update(invoices)
        .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
        .where(eq(invoices.id, input.invoiceId))
        .returning();
      return updated;
    }),

  // Billing adjustments — credits, refunds, discounts per invoice
  getAdjustments: orgAdminProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, orgId)));
      if (!invoice) throw new Error('Invoice not found or access denied');
      return await db.select().from(billingAdjustments).where(eq(billingAdjustments.invoiceId, input.invoiceId)).orderBy(desc(billingAdjustments.createdAt));
    }),

  addAdjustment: orgAdminProcedure
    .input(z.object({
      invoiceId: z.string().uuid(),
      type: z.enum(['credit', 'debit', 'discount', 'refund', 'tax']),
      amount: z.string(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, orgId)));
      if (!invoice) throw new Error('Invoice not found or access denied');
      const [created] = await db.insert(billingAdjustments).values({
        invoiceId: input.invoiceId,
        type: input.type,
        amount: input.amount,
        reason: input.reason,
        createdById: ctx.dbUser!.id,
      }).returning();
      return created;
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS ROUTER
// ─────────────────────────────────────────────────────────────────────────────
export const analyticsRouter = router({
  getAdjustmentLogs: orgAdminProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db.select().from(mealAdjustmentLogs).where(eq(mealAdjustmentLogs.organizationId, orgId)).orderBy(desc(mealAdjustmentLogs.createdAt));
  }),

  getAggregateReport: orgAdminProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;

      const logs = await db.select().from(mealAdjustmentLogs).where(
        and(eq(mealAdjustmentLogs.organizationId, orgId), sql`${mealAdjustmentLogs.date} >= ${input.startDate}`, sql`${mealAdjustmentLogs.date} <= ${input.endDate}`)
      );

      // SQL aggregation to avoid memory accumulation at scale
      const dailySums = await db
        .select({
          date: mealConfirmations.date,
          slotName: mealSlots.name,
          totalMeals: sql<number>`SUM(${mealConfirmations.quantity})`,
        })
        .from(mealConfirmations)
        .innerJoin(mealSlots, eq(mealConfirmations.mealSlotId, mealSlots.id))
        .innerJoin(profiles, eq(mealConfirmations.memberId, profiles.id))
        .where(and(
          eq(profiles.organizationId, orgId),
          eq(mealConfirmations.status, 'confirmed'),
          sql`${mealConfirmations.date} >= ${input.startDate}`,
          sql`${mealConfirmations.date} <= ${input.endDate}`,
        ))
        .groupBy(mealConfirmations.date, mealSlots.name)
        .orderBy(asc(mealConfirmations.date));

      return { dailySums, adjustmentsCount: logs.length, adjustmentLogs: logs };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// ROOT ROUTER
// ─────────────────────────────────────────────────────────────────────────────
export const appRouter = router({
  organization: organizationRouter,
  meal: mealRouter,
  billing: billingRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
