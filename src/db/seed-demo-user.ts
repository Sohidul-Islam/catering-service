import './polyfill-websocket';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Parse .env manually
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index === -1) return;
      const key = trimmed.substring(0, index).trim();
      let val = trimmed.substring(index + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      } else if (val.startsWith("'") && val.endsWith("'")) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    });
  }
} catch (err) {
  console.error('Error loading .env file:', err);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing in .env');
  process.exit(1);
}

// Check if we have a real service role key
const hasServiceRoleKey = serviceRoleKey && serviceRoleKey !== 'your-service-role-key';

async function seed() {
  const { db } = await import('./index');
  const { organizations } = await import('./schema/organizations');
  const { profiles } = await import('./schema/users');
  const { eq, sql } = await import('drizzle-orm');

  console.log('--- SEEDING DEMO DATA ---');

  // 1. Create or Find Organization
  let orgId: string;
  try {
    const existingOrgs = await db.select().from(organizations).where(eq(organizations.name, 'Demo Catering Corp'));
    if (existingOrgs.length > 0) {
      orgId = existingOrgs[0].id;
      console.log(`Found existing organization: "Demo Catering Corp" (ID: ${orgId})`);
    } else {
      const [newOrg] = await db.insert(organizations).values({
        name: 'Demo Catering Corp',
        billingEmail: 'billing@democatering.com',
        timezone: 'America/New_York',
      }).returning();
      orgId = newOrg.id;
      console.log(`Created new organization: "Demo Catering Corp" (ID: ${orgId})`);
    }
  } catch (error) {
    console.error('Failed to create/retrieve organization:', error);
    process.exit(1);
  }

  // Define users to create
  const usersToCreate = [
    {
      email: 'demo@catering.com',
      password: 'Password123',
      fullName: 'Demo Admin',
      role: 'org_admin' as const,
      organizationId: orgId,
    },
    {
      email: 'superadmin@catering.com',
      password: 'Password123',
      fullName: 'Super Admin',
      role: 'super_admin' as const,
      organizationId: null,
    }
  ];

  for (const user of usersToCreate) {
    console.log(`\nProcessing user: ${user.email}...`);
    let supabaseUid: string | null = null;

    // Check if user already exists in auth.users database
    try {
      const authUserResult = await db.execute(sql`SELECT id FROM auth.users WHERE email = ${user.email}`);
      if (authUserResult.length > 0) {
        supabaseUid = authUserResult[0].id as string;
        console.log(`Found existing auth.users record: ${user.email} (UID: ${supabaseUid})`);
        
        // Confirm the email in case it's unconfirmed (omitted confirmed_at column)
        await db.execute(sql`
          UPDATE auth.users
          SET email_confirmed_at = NOW(),
              raw_user_meta_data = raw_user_meta_data || '{"email_verified": true}'::jsonb,
              updated_at = NOW()
          WHERE id = ${supabaseUid}
        `);
        
        // Check if identity exists
        const identityResult = await db.execute(sql`SELECT id FROM auth.identities WHERE user_id = ${supabaseUid}`);
        if (identityResult.length > 0) {
          await db.execute(sql`
            UPDATE auth.identities
            SET identity_data = identity_data || '{"email_verified": true}'::jsonb,
                updated_at = NOW()
            WHERE user_id = ${supabaseUid}
          `);
        } else {
          // If for some reason identity doesn't exist, create it (omitted email column)
          const identityId = crypto.randomUUID();
          await db.execute(sql`
            INSERT INTO auth.identities (
              id, user_id, identity_data, provider, provider_id,
              last_sign_in_at, created_at, updated_at
            ) VALUES (
              ${identityId},
              ${supabaseUid},
              ${JSON.stringify({ sub: supabaseUid, email: user.email, email_verified: true, phone_verified: false })}::jsonb,
              'email',
              ${supabaseUid},
              NOW(),
              NOW(),
              NOW()
            )
          `);
        }
        console.log(`Confirmed email for user: ${user.email}`);
      } else {
        // If they don't exist, we create them directly in auth.users and auth.identities
        supabaseUid = crypto.randomUUID();
        console.log(`Creating new user in auth.users: ${user.email} (UID: ${supabaseUid})`);

        // Standard hash for 'Password123'
        const passwordHash = '$2a$10$ob4HB99ZiolMoJPUecLumupSLzQF/mo7pzCqilRsRLmRduhCrIaQ6';

        // Omitted generated column confirmed_at
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
            ${user.email},
            ${passwordHash},
            NOW(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            ${JSON.stringify({ sub: supabaseUid, email: user.email, email_verified: true, phone_verified: false })}::jsonb,
            false,
            false,
            NOW(),
            NOW()
          )
        `);

        // Omitted generated column email
        const identityId = crypto.randomUUID();
        await db.execute(sql`
          INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id,
            last_sign_in_at, created_at, updated_at
          ) VALUES (
            ${identityId},
            ${supabaseUid},
            ${JSON.stringify({ sub: supabaseUid, email: user.email, email_verified: true, phone_verified: false })}::jsonb,
            'email',
            ${supabaseUid},
            NOW(),
            NOW(),
            NOW()
          )
        `);
        console.log(`Successfully created auth and identity records for: ${user.email}`);
      }
    } catch (error) {
      console.error(`Error processing auth record for ${user.email}:`, error);
    }

    if (!supabaseUid) {
      console.error(`Could not retrieve or create user UID for ${user.email}. Skipping database profile creation.`);
      continue;
    }

    // 2. Create profile in database
    try {
      // Check if profile exists with this email to avoid unique key constraint violation
      const existingProfilesByEmail = await db.select().from(profiles).where(eq(profiles.email, user.email));
      if (existingProfilesByEmail.length > 0) {
        const oldProfile = existingProfilesByEmail[0];
        if (oldProfile.id !== supabaseUid) {
          console.log(`Deleting old profile with ID ${oldProfile.id} for email ${user.email} to resolve ID mismatch.`);
          await db.delete(profiles).where(eq(profiles.id, oldProfile.id));
          
          await db.insert(profiles).values({
            id: supabaseUid,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            organizationId: user.organizationId,
          });
          console.log(`Created database profile for ${user.email} with correct ID.`);
        } else {
          await db.update(profiles).set({
            role: user.role,
            organizationId: user.organizationId,
            fullName: user.fullName,
          }).where(eq(profiles.id, supabaseUid));
          console.log(`Updated database profile for ${user.email}.`);
        }
      } else {
        await db.insert(profiles).values({
          id: supabaseUid,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          organizationId: user.organizationId,
        });
        console.log(`Created database profile for ${user.email}.`);
      }
    } catch (error) {
      console.error(`Failed to insert database profile for ${user.email}:`, error);
    }
  }

  console.log('\nSeeding completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed script encountered error:', err);
  process.exit(1);
});
