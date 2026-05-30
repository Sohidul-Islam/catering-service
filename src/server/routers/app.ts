import { router, superAdminProcedure, orgAdminProcedure, orgMemberProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '@/db';
import { organizations, profiles, mealSlots, recurringPreferences, mealConfirmations, invoices, mealAdjustmentLogs } from '@/db/schema';
import { desc, eq, and, sql } from 'drizzle-orm';
import { mealService } from '../services/meal.service';
import { billingService } from '../services/billing.service';

export const organizationRouter = router({
  create: superAdminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        billingEmail: z.string().email(),
        timezone: z.string().default('UTC'),
        logoUrl: z.string().optional(),
      })
    )
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
    .input(
      z.object({
        name: z.string().min(1),
        billingEmail: z.string().email(),
        timezone: z.string().default('UTC'),
        logoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [updated] = await db
        .update(organizations)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(organizations.id, orgId))
        .returning();
      return updated;
    }),

  getMembers: orgAdminProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db
      .select()
      .from(profiles)
      .where(eq(profiles.organizationId, orgId))
      .orderBy(desc(profiles.createdAt));
  }),

  addMember: orgAdminProcedure
    .input(
      z.object({
        id: z.string(), // Supabase UID
        email: z.string().email(),
        fullName: z.string().optional(),
        role: z.enum(['org_admin', 'org_member']).default('org_member'),
        mealBehaviorType: z.enum(['recurring', 'flexible']).default('flexible'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [created] = await db
        .insert(profiles)
        .values({
          ...input,
          organizationId: orgId,
        })
        .returning();
      return created;
    }),

  toggleMemberBehavior: orgAdminProcedure
    .input(
      z.object({
        memberId: z.string(),
        mealBehaviorType: z.enum(['recurring', 'flexible']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [updated] = await db
        .update(profiles)
        .set({ mealBehaviorType: input.mealBehaviorType, updatedAt: new Date() })
        .where(and(eq(profiles.id, input.memberId), eq(profiles.organizationId, orgId)))
        .returning();
      return updated;
    }),

  // Slot management
  getSlots: orgMemberProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db
      .select()
      .from(mealSlots)
      .where(eq(mealSlots.organizationId, orgId))
      .orderBy(mealSlots.startTime);
  }),

  createSlot: orgAdminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        startTime: z.string(),
        endTime: z.string(),
        confirmationDeadline: z.string(),
        deadlineDaysAhead: z.number().default(0),
        price: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const [slot] = await db
        .insert(mealSlots)
        .values({
          ...input,
          organizationId: orgId,
        })
        .returning();
      return slot;
    }),
});

export const mealRouter = router({
  getConfirmations: orgMemberProcedure
    .input(
      z.object({
        startDate: z.string(), // YYYY-MM-DD
        endDate: z.string(),   // YYYY-MM-DD
      })
    )
    .query(async ({ input, ctx }) => {
      return await mealService.getMemberConfirmationsForRange(
        ctx.dbUser!.id,
        input.startDate,
        input.endDate
      );
    }),

  confirmMeal: orgMemberProcedure
    .input(
      z.object({
        mealSlotId: z.string().uuid(),
        date: z.string(),
        status: z.enum(['confirmed', 'skipped']),
        quantity: z.number().min(1).default(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await mealService.submitConfirmation({
        memberId: ctx.dbUser!.id,
        ...input,
      });
    }),

  saveRecurringPreferences: orgMemberProcedure
    .input(
      z.array(
        z.object({
          mealSlotId: z.string().uuid(),
          dayOfWeek: z.number().min(0).max(6),
          quantity: z.number().min(1).default(1),
        })
      )
    )
    .mutation(async ({ input, ctx }) => {
      const memberId = ctx.dbUser!.id;
      
      // Delete existing weekly preferences
      await db.delete(recurringPreferences).where(eq(recurringPreferences.memberId, memberId));
      
      if (input.length === 0) return { success: true };

      // Insert new preferences
      const preferencesToInsert = input.map((pref) => ({
        memberId,
        mealSlotId: pref.mealSlotId,
        dayOfWeek: pref.dayOfWeek,
        quantity: pref.quantity,
      }));

      await db.insert(recurringPreferences).values(preferencesToInsert);
      return { success: true };
    }),

  getRecurringPreferences: orgMemberProcedure.query(async ({ ctx }) => {
    return await db
      .select()
      .from(recurringPreferences)
      .where(eq(recurringPreferences.memberId, ctx.dbUser!.id));
  }),

  adminOverride: orgAdminProcedure
    .input(
      z.object({
        memberId: z.string(),
        mealSlotId: z.string().uuid(),
        date: z.string(),
        status: z.enum(['confirmed', 'skipped']),
        quantity: z.number().min(1).default(1),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await mealService.adminOverride({
        performedById: ctx.dbUser!.id,
        ...input,
      });
    }),

  getDailyStats: orgAdminProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      
      // Retrieve slots
      const slots = await db
        .select()
        .from(mealSlots)
        .where(and(eq(mealSlots.organizationId, orgId), eq(mealSlots.isActive, true)));

      // Retrieve all members
      const members = await db.select().from(profiles).where(eq(profiles.organizationId, orgId));

      // Get confirmations for this day restricted to this organization only (Security Fix)
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
        })
        .from(mealConfirmations)
        .innerJoin(profiles, eq(mealConfirmations.memberId, profiles.id))
        .where(
          and(
            eq(profiles.organizationId, orgId),
            eq(mealConfirmations.date, input.date)
          )
        );

      // Get recurring preferences for all organization members (Security Fix)
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
        .where(eq(profiles.organizationId, orgId));

      const d = new Date(input.date + 'T00:00:00Z');
      const dayOfWeek = d.getUTCDay(); // UTC safe check

      const stats = slots.map((slot) => {
        let confirmedCount = 0;
        let skippedCount = 0;
        let pendingCount = 0;

        for (const member of members) {
          const explicitConf = confirmations.find(
            (c) => c.memberId === member.id && c.mealSlotId === slot.id
          );

          if (explicitConf) {
            if (explicitConf.status === 'confirmed') confirmedCount += explicitConf.quantity;
            else skippedCount += 1;
          } else if (member.mealBehaviorType === 'recurring') {
            const pref = recurringPrefs.find(
              (p) => p.memberId === member.id && p.mealSlotId === slot.id && p.dayOfWeek === dayOfWeek
            );
            if (pref) confirmedCount += pref.quantity;
            else pendingCount += 1;
          } else {
            pendingCount += 1;
          }
        }

        return {
          slotId: slot.id,
          slotName: slot.name,
          time: `${slot.startTime} - ${slot.endTime}`,
          confirmedCount,
          skippedCount,
          pendingCount,
          price: slot.price,
        };
      });

      return stats;
    }),
});

export const billingRouter = router({
  getInvoices: orgAdminProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, orgId))
      .orderBy(desc(invoices.createdAt));
  }),

  generateInvoice: orgAdminProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
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

      // 1. Fetch the invoice and verify it belongs to this organization (Security Isolation Check)
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, orgId)));

      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }

      // 2. Update status manually to paid
      const [updated] = await db
        .update(invoices)
        .set({
          status: 'paid',
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.invoiceId))
        .returning();

      return updated;
    }),
});

export const analyticsRouter = router({
  getAdjustmentLogs: orgAdminProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db
      .select()
      .from(mealAdjustmentLogs)
      .where(eq(mealAdjustmentLogs.organizationId, orgId))
      .orderBy(desc(mealAdjustmentLogs.createdAt));
  }),

  getAggregateReport: orgAdminProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      
      const logs = await db
        .select()
        .from(mealAdjustmentLogs)
        .where(
          and(
            eq(mealAdjustmentLogs.organizationId, orgId),
            sql`${mealAdjustmentLogs.date} >= ${input.startDate}`,
            sql`${mealAdjustmentLogs.date} <= ${input.endDate}`
          )
        );

      const confirmations = await db
        .select({
          date: mealConfirmations.date,
          status: mealConfirmations.status,
          quantity: mealConfirmations.quantity,
          slotName: mealSlots.name,
        })
        .from(mealConfirmations)
        .innerJoin(mealSlots, eq(mealConfirmations.mealSlotId, mealSlots.id))
        .innerJoin(profiles, eq(mealConfirmations.memberId, profiles.id))
        .where(
          and(
            eq(profiles.organizationId, orgId),
            sql`${mealConfirmations.date} >= ${input.startDate}`,
            sql`${mealConfirmations.date} <= ${input.endDate}`
          )
        );

      return {
        confirmations,
        adjustmentsCount: logs.length,
        adjustmentLogs: logs,
      };
    }),
});

export const appRouter = router({
  organization: organizationRouter,
  meal: mealRouter,
  billing: billingRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
