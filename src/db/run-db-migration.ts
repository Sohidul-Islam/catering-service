import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function runMigration() {
  console.log('Running manual database migrations to create billing_snapshots...');
  try {
    const { db } = await import('./index');
    const { sql } = await import('drizzle-orm');
    // 1. Create the billing_snapshots table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "billing_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "invoice_id" uuid NOT NULL,
        "meal_slot_id" uuid NOT NULL,
        "slot_name" text NOT NULL,
        "unit_price" numeric(10, 2) NOT NULL,
        "total_quantity" integer NOT NULL,
        "total_amount" numeric(10, 2) NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('billing_snapshots table verified/created.');

    // 2. Add foreign keys (wrapped in try/catch to avoid errors if they already exist)
    try {
      await db.execute(sql`
        ALTER TABLE "billing_snapshots" 
        ADD CONSTRAINT "billing_snapshots_invoice_id_invoices_id_fk" 
        FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") 
        ON DELETE cascade ON UPDATE no action
      `);
      console.log('Added invoice_id foreign key constraint.');
    } catch (e: any) {
      console.log('invoice_id constraint may already exist:', e.message || e);
    }

    try {
      await db.execute(sql`
        ALTER TABLE "billing_snapshots" 
        ADD CONSTRAINT "billing_snapshots_meal_slot_id_meal_slots_id_fk" 
        FOREIGN KEY ("meal_slot_id") REFERENCES "public"."meal_slots"("id") 
        ON DELETE cascade ON UPDATE no action
      `);
      console.log('Added meal_slot_id foreign key constraint.');
    } catch (e: any) {
      console.log('meal_slot_id constraint may already exist:', e.message || e);
    }

    // 3. Add price column to meal_confirmations
    try {
      await db.execute(sql`
        ALTER TABLE "meal_confirmations" ADD COLUMN IF NOT EXISTS "price" numeric(10, 2);
      `);
      console.log('Added price column to meal_confirmations.');
    } catch (e: any) {
      console.log('Could not add price column:', e.message || e);
    }

    // 4. Create performance indexes
    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_confirmations_member_date" ON "meal_confirmations" ("member_id", "date");
        CREATE INDEX IF NOT EXISTS "idx_profiles_org_id" ON "profiles" ("organization_id");
        CREATE INDEX IF NOT EXISTS "idx_slots_org_id" ON "meal_slots" ("organization_id");
      `);
      console.log('Performance indexes verified/created.');
    } catch (e: any) {
      console.log('Could not create indexes:', e.message || e);
    }

    // 5. Backfill existing confirmation prices from meal_slots
    try {
      await db.execute(sql`
        UPDATE "meal_confirmations" mc
        SET "price" = ms."price"
        FROM "meal_slots" ms
        WHERE mc."meal_slot_id" = ms."id" AND mc."price" IS NULL;
      `);
      console.log('Backfilled existing confirmation prices.');
    } catch (e: any) {
      console.log('Could not backfill prices:', e.message || e);
    }

    // 6. Create holidays table
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "holidays" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
          "date" text NOT NULL,
          "name" text NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('holidays table verified/created.');
    } catch (e: any) {
      console.log('Could not create holidays table:', e.message || e);
    }

    // 7. Create holidays index
    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_holidays_org_date" ON "holidays" ("organization_id", "date");
      `);
      console.log('holidays index verified/created.');
    } catch (e: any) {
      console.log('Could not create holidays index:', e.message || e);
    }

    // 8. Add joined_at and left_at to profiles
    try {
      await db.execute(sql`
        ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "joined_at" timestamp DEFAULT now() NOT NULL;
      `);
      await db.execute(sql`
        ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "left_at" timestamp;
      `);
      console.log('Added joined_at and left_at columns to profiles.');
    } catch (e: any) {
      console.log('Could not add lifecycle columns to profiles:', e.message || e);
    }

    // 9. Backfill joined_at from created_at for existing profiles
    try {
      await db.execute(sql`
        UPDATE "profiles" SET "joined_at" = "created_at" WHERE "joined_at" > "created_at";
      `);
      console.log('Backfilled joined_at from created_at.');
    } catch (e: any) {
      console.log('Could not backfill joined_at:', e.message || e);
    }

    // 10. Create departments table
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "departments" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
          "name" text NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_departments_org_id" ON "departments" ("organization_id")`);
      console.log('departments table verified/created.');
    } catch (e: any) {
      console.log('Could not create departments table:', e.message || e);
    }

    // 11. Create office_locations table
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "office_locations" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
          "name" text NOT NULL,
          "address" text,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_office_locations_org_id" ON "office_locations" ("organization_id")`);
      console.log('office_locations table verified/created.');
    } catch (e: any) {
      console.log('Could not create office_locations table:', e.message || e);
    }

    // 12. Create billing_adjustments table
    try {
      await db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE adjustment_type AS ENUM ('credit', 'debit', 'discount', 'refund', 'tax');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "billing_adjustments" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "invoice_id" uuid NOT NULL REFERENCES "public"."invoices"("id") ON DELETE CASCADE,
          "type" adjustment_type NOT NULL,
          "amount" numeric(10, 2) NOT NULL,
          "reason" text NOT NULL,
          "created_by_id" text REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_billing_adj_invoice_id" ON "billing_adjustments" ("invoice_id")`);
      console.log('billing_adjustments table verified/created.');
    } catch (e: any) {
      console.log('Could not create billing_adjustments table:', e.message || e);
    }

    // 13. Create member_leaves table
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "member_leaves" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "member_id" text NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
          "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
          "start_date" text NOT NULL,
          "end_date" text NOT NULL,
          "reason" text,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_member_leaves_member_org" ON "member_leaves" ("member_id", "organization_id")`);
      console.log('member_leaves table verified/created.');
    } catch (e: any) {
      console.log('Could not create member_leaves table:', e.message || e);
    }

    // 14. Add capacity column to meal_slots
    try {
      await db.execute(sql`ALTER TABLE "meal_slots" ADD COLUMN IF NOT EXISTS "capacity" integer;`);
      console.log('Added capacity column to meal_slots.');
    } catch (e: any) {
      console.log('Could not add capacity column:', e.message || e);
    }

    // 15. Add department_id, office_location_id, is_active to profiles
    try {
      await db.execute(sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "department_id" uuid;`);
      await db.execute(sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "office_location_id" uuid;`);
      await db.execute(sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;`);
      console.log('Added department_id, office_location_id, is_active to profiles.');
    } catch (e: any) {
      console.log('Could not add new profile columns:', e.message || e);
    }

    console.log('Manual database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
