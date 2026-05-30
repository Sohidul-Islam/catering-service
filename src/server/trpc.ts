import { initTRPC, TRPCError } from '@trpc/server';
import { createClient } from './lib/supabase';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { profiles, organizations } from '@/db/schema';

export async function createContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let dbUser = null;
  if (user) {
    const records = await db.select().from(profiles).where(eq(profiles.id, user.id));
    dbUser = records[0] || null;
  }

  return {
    user,
    dbUser,
    db,
  };
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware to check authentication
const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in.' });
  }
  return next({
    ctx: {
      user: ctx.user,
      dbUser: ctx.dbUser,
    },
  });
});

// Middleware to check super_admin role
const isSuperAdmin = t.middleware(({ next, ctx }) => {
  if (!ctx.user || !ctx.dbUser || ctx.dbUser.role !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Super admin access required.' });
  }
  return next({
    ctx: {
      user: ctx.user,
      dbUser: ctx.dbUser,
    },
  });
});

// Middleware to check org_admin role
const isOrgAdmin = t.middleware(async ({ next, ctx }) => {
  if (!ctx.user || !ctx.dbUser || ctx.dbUser.role !== 'org_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization admin access required.' });
  }
  if (ctx.dbUser.organizationId) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, ctx.dbUser.organizationId));
    if (!org || !org.isApproved) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization is pending approval by Super Admin.' });
    }
  }
  return next({
    ctx: {
      user: ctx.user,
      dbUser: ctx.dbUser,
    },
  });
});

// Middleware to check org member access (must have at least org_member or org_admin role)
const isOrgMemberOrAdmin = t.middleware(async ({ next, ctx }) => {
  if (
    !ctx.user ||
    !ctx.dbUser ||
    (ctx.dbUser.role !== 'org_member' && ctx.dbUser.role !== 'org_admin')
  ) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization member access required.' });
  }
  if (ctx.dbUser.organizationId) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, ctx.dbUser.organizationId));
    if (!org || !org.isApproved) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization is pending approval by Super Admin.' });
    }
  }
  return next({
    ctx: {
      user: ctx.user,
      dbUser: ctx.dbUser,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
export const superAdminProcedure = t.procedure.use(isSuperAdmin);
export const orgAdminProcedure = t.procedure.use(isOrgAdmin);
export const orgMemberProcedure = t.procedure.use(isOrgMemberOrAdmin);

