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

    console.log('Manual database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
