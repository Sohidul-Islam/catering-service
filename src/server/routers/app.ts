import { router, superAdminProcedure, orgAdminProcedure, orgMemberProcedure, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '@/db';
import {
  organizations, profiles, mealSlots, recurringPreferences, mealConfirmations,
  invoices, mealAdjustmentLogs, holidays, departments, officeLocations,
  billingAdjustments, memberLeaves, organizationMembers, invitations,
} from '@/db/schema';
import { desc, eq, and, sql, asc } from 'drizzle-orm';
import { mealService } from '../services/meal.service';
import { billingService } from '../services/billing.service';
import { supabaseAdmin } from '../lib/supabase';
import crypto from 'crypto';


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
      const [org] = await db.insert(organizations).values({ ...input, isApproved: true }).returning();
      return org;
    }),

  register: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      billingEmail: z.string().email(),
      timezone: z.string().default('UTC'),
      adminEmail: z.string().email(),
      adminPassword: z.string().min(6),
      adminName: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      // 1. Create the Supabase user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: input.adminEmail,
        password: input.adminPassword,
        email_confirm: true,
      });

      if (authError || !authUser.user) {
        throw new Error(authError?.message || 'Failed to create admin user account');
      }

      // 2. Create the organization (unapproved)
      const [org] = await db.insert(organizations).values({
        name: input.name,
        billingEmail: input.billingEmail,
        timezone: input.timezone,
        isApproved: false,
      }).returning();

      // 3. Create the profile for the admin user
      await db.insert(profiles).values({
        id: authUser.user.id,
        email: input.adminEmail,
        fullName: input.adminName,
        role: 'org_admin',
        organizationId: org.id,
        isActive: true,
      });

      // 4. Create the organization member mapping
      await db.insert(organizationMembers).values({
        profileId: authUser.user.id,
        organizationId: org.id,
        role: 'org_admin',
      });

      return org;
    }),

  approve: superAdminProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(organizations)
        .set({ isApproved: true, updatedAt: new Date() })
        .where(eq(organizations.id, input.organizationId))
        .returning();
      return updated;
    }),

  reject: superAdminProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(organizations).where(eq(organizations.id, input.organizationId));
      return { success: true };
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

  // ── Multi-Org & Invitations ──────────────────────────────────────────────
  getMyOrganizations: protectedProcedure.query(async ({ ctx }) => {
    return await db
      .select({
        id: organizations.id,
        name: organizations.name,
        logoUrl: organizations.logoUrl,
        isApproved: organizations.isApproved,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.profileId, ctx.user.id));
  }),

  switchOrganization: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [membership] = await db
        .select()
        .from(organizationMembers)
        .where(and(eq(organizationMembers.profileId, ctx.user.id), eq(organizationMembers.organizationId, input.organizationId)));
      
      if (!membership) {
        throw new Error('Access denied: not a member of this organization');
      }

      await db
        .update(profiles)
        .set({ organizationId: input.organizationId, role: membership.role, updatedAt: new Date() })
        .where(eq(profiles.id, ctx.user.id));

      return { success: true };
    }),

  inviteMember: orgAdminProcedure
    .input(z.object({
      email: z.string().email(),
      role: z.enum(['org_admin', 'org_member']).default('org_member'),
    }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      const emailLower = input.email.toLowerCase();

      // 1. Check if user already exists in Supabase auth.users
      const authUserResult = await db.execute(sql`SELECT id FROM auth.users WHERE email = ${emailLower}`);
      let supabaseUid: string;

      if (authUserResult.length > 0) {
        supabaseUid = authUserResult[0].id as string;
        
        // Ensure email is confirmed
        await db.execute(sql`
          UPDATE auth.users
          SET email_confirmed_at = NOW(),
              raw_user_meta_data = raw_user_meta_data || '{"email_verified": true}'::jsonb,
              updated_at = NOW()
          WHERE id = ${supabaseUid}
        `);
      } else {
        // Forcefully create the user in auth.users and auth.identities
        supabaseUid = crypto.randomUUID();
        const passwordHash = '$2a$10$EqhC69sWwS.Q.DpewVfMreW1UoJk52pLp/dI6yXg.K0C/R.G9nKOC'; // 'password'

        await db.execute(sql`
          INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            is_sso_user, is_anonymous, created_at, updated_at
          ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            ${supabaseUid},
            'authenticated',
            'authenticated',
            ${emailLower},
            ${passwordHash},
            NOW(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            ${JSON.stringify({ sub: supabaseUid, email: emailLower, email_verified: true, phone_verified: false })}::jsonb,
            false,
            false,
            NOW(),
            NOW()
          )
        `);

        const identityId = crypto.randomUUID();
        await db.execute(sql`
          INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id,
            last_sign_in_at, created_at, updated_at
          ) VALUES (
            ${identityId},
            ${supabaseUid},
            ${JSON.stringify({ sub: supabaseUid, email: emailLower, email_verified: true, phone_verified: false })}::jsonb,
            'email',
            ${supabaseUid},
            NOW(),
            NOW(),
            NOW()
          )
        `);
      }

      // 2. Check/Create database profile
      const [existingProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, supabaseUid));

      if (existingProfile) {
        await db.update(profiles).set({
          organizationId: orgId,
          role: input.role,
          updatedAt: new Date()
        }).where(eq(profiles.id, supabaseUid));
      } else {
        await db.insert(profiles).values({
          id: supabaseUid,
          email: emailLower,
          role: input.role,
          organizationId: orgId,
          isActive: true,
        });
      }

      // 3. Add to organization members mapping if not already there
      const [existingMember] = await db
        .select()
        .from(organizationMembers)
        .where(and(eq(organizationMembers.profileId, supabaseUid), eq(organizationMembers.organizationId, orgId)));
      
      if (!existingMember) {
        await db.insert(organizationMembers).values({
          profileId: supabaseUid,
          organizationId: orgId,
          role: input.role,
        });
      }

      // 4. Create accepted invitation record
      const [invite] = await db.insert(invitations).values({
        email: emailLower,
        organizationId: orgId,
        role: input.role,
        status: 'accepted',
      }).returning();

      return invite;
    }),

  getSentInvitations: orgAdminProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, orgId))
      .orderBy(desc(invitations.createdAt));
  }),

  getPendingInvitations: protectedProcedure.query(async ({ ctx }) => {
    return await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
        createdAt: invitations.createdAt,
        organizationName: organizations.name,
      })
      .from(invitations)
      .innerJoin(organizations, eq(invitations.organizationId, organizations.id))
      .where(and(eq(invitations.email, ctx.user.email!), eq(invitations.status, 'pending')));
  }),

  acceptInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [invite] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.id, input.invitationId));

      if (!invite || invite.status !== 'pending') {
        throw new Error('Invitation not found or no longer pending.');
      }

      if (invite.email.toLowerCase() !== ctx.user.email!.toLowerCase()) {
        throw new Error('This invitation was sent to a different email address.');
      }

      // Check if already a member
      const [existingMember] = await db
        .select()
        .from(organizationMembers)
        .where(and(eq(organizationMembers.profileId, ctx.user.id), eq(organizationMembers.organizationId, invite.organizationId)));

      if (!existingMember) {
        await db.insert(organizationMembers).values({
          profileId: ctx.user.id,
          organizationId: invite.organizationId,
          role: invite.role,
        });
      }

      // Accept invitation
      await db
        .update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, input.invitationId));

      // Switch active organization
      await db
        .update(profiles)
        .set({ organizationId: invite.organizationId, role: invite.role, updatedAt: new Date() })
        .where(eq(profiles.id, ctx.user.id));

      return { success: true };
    }),

  declineInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [invite] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.id, input.invitationId));

      if (!invite || invite.status !== 'pending') {
        throw new Error('Invitation not found or no longer pending.');
      }

      if (invite.email.toLowerCase() !== ctx.user.email!.toLowerCase()) {
        throw new Error('This invitation was sent to a different email address.');
      }

      await db
        .update(invitations)
        .set({ status: 'declined' })
        .where(eq(invitations.id, input.invitationId));

      return { success: true };
    }),

  // ── Member Management ────────────────────────────────────────────────────
  getMembers: orgAdminProcedure.query(async ({ ctx }) => {
    const orgId = ctx.dbUser!.organizationId!;
    return await db
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        phoneNumber: profiles.phoneNumber,
        role: organizationMembers.role,
        mealBehaviorType: profiles.mealBehaviorType,
        departmentId: profiles.departmentId,
        officeLocationId: profiles.officeLocationId,
        isActive: profiles.isActive,
        joinedAt: profiles.joinedAt,
        leftAt: profiles.leftAt,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles)
      .innerJoin(organizationMembers, eq(profiles.id, organizationMembers.profileId))
      .where(and(eq(organizationMembers.organizationId, orgId), eq(profiles.isActive, true)))
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
      
      const [existingProfile] = await db.select().from(profiles).where(eq(profiles.email, input.email));
      let profileId = input.id;
      let created = null;

      if (!existingProfile) {
        [created] = await db.insert(profiles).values({
          ...rest,
          organizationId: orgId,
          joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
        }).returning();
        profileId = created.id;
      } else {
        profileId = existingProfile.id;
        created = existingProfile;
      }

      const [existingMember] = await db
        .select()
        .from(organizationMembers)
        .where(and(eq(organizationMembers.profileId, profileId), eq(organizationMembers.organizationId, orgId)));
      
      if (!existingMember) {
        await db.insert(organizationMembers).values({
          profileId,
          organizationId: orgId,
          role: input.role,
        });
      }

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

  deleteSlot: orgAdminProcedure
    .input(z.object({ slotId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.dbUser!.organizationId!;
      await db.delete(mealSlots).where(and(eq(mealSlots.id, input.slotId), eq(mealSlots.organizationId, orgId)));
      return { success: true };
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

  getCurrentProfile: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.dbUser) return null;
    return {
      id: ctx.dbUser.id,
      email: ctx.dbUser.email,
      fullName: ctx.dbUser.fullName,
      phoneNumber: ctx.dbUser.phoneNumber,
      role: ctx.dbUser.role,
      organizationId: ctx.dbUser.organizationId,
    };
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
