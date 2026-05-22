import './polyfill-websocket';
import * as fs from 'fs';
import * as path from 'path';
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
  const { eq } = await import('drizzle-orm');

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

    if (hasServiceRoleKey) {
      console.log('Using Supabase admin client to create/confirm user...');
      const adminClient = createClient(supabaseUrl!, serviceRoleKey!);
      
      // Try to create user
      const { data, error } = await adminClient.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (error) {
        if (error.message.includes('already exists') || error.message.includes('already registered')) {
          console.log('User already exists in Supabase. Retrieving UID via authentication...');
          const client = createClient(supabaseUrl!, supabaseAnonKey!);
          const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
            email: user.email,
            password: user.password,
          });
          if (signInError) {
            console.error(`Failed to authenticate existing user: ${signInError.message}`);
          } else if (signInData.user) {
            supabaseUid = signInData.user.id;
          }
        } else {
          console.error(`Failed to create user via admin client: ${error.message}`);
        }
      } else if (data.user) {
        supabaseUid = data.user.id;
        console.log(`Successfully created user in Supabase (UID: ${supabaseUid})`);
      }
    } else {
      console.log('Service role key not found/placeholder. Using public client...');
      const client = createClient(supabaseUrl!, supabaseAnonKey!);
      
      console.log('Attempting sign-in first...');
      const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });

      if (signInData && signInData.user) {
        supabaseUid = signInData.user.id;
        console.log(`User already exists and authenticated successfully (UID: ${supabaseUid})`);
      } else {
        console.log(`Sign-in did not succeed: ${signInError?.message || 'Unknown'}. Attempting public sign-up...`);
        const { data: signUpData, error: signUpError } = await client.auth.signUp({
          email: user.email,
          password: user.password,
        });

        if (signUpError) {
          console.error(`Public signup failed: ${signUpError.message}`);
        } else if (signUpData && signUpData.user) {
          supabaseUid = signUpData.user.id;
          console.log(`Signed up user in Supabase (UID: ${supabaseUid})`);
          console.log(`WARNING: If email confirmation is enabled in your Supabase dashboard, check your inbox or disable it in Supabase Auth settings to log in.`);
        } else {
          console.log('Public signup returned no user and no error.');
        }
      }
    }

    if (!supabaseUid) {
      console.error(`Could not retrieve or create user UID for ${user.email}. Skipping database profile creation.`);
      continue;
    }

    // 2. Create profile in database
    try {
      const existingProfiles = await db.select().from(profiles).where(eq(profiles.id, supabaseUid));
      if (existingProfiles.length > 0) {
        await db.update(profiles).set({
          role: user.role,
          organizationId: user.organizationId,
          fullName: user.fullName,
        }).where(eq(profiles.id, supabaseUid));
        console.log(`Updated database profile for ${user.email}.`);
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
