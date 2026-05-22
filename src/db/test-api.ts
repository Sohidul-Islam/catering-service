import './polyfill-websocket';
import { appRouter } from '../server/routers/app';
import { db } from './index';
import { organizations, profiles, mealSlots, mealConfirmations, invoices, billingSnapshots } from './index';
import { billingService } from '../server/services/billing.service';
import { eq } from 'drizzle-orm';

async function testBillingSnapshots() {
  console.log('\n--- STARTING BILLING SNAPSHOTS TEST ---');
  let testOrgId: string | null = null;
  const testMemberId = 'test-member-uuid-temp';
  let testSlotId: string | null = null;
  let testInvoiceId: string | null = null;

  try {
    // 1. Create a test organization
    console.log('Creating test organization...');
    const [org] = await db.insert(organizations).values({
      name: 'Snapshot Test Org',
      billingEmail: 'billing@snapshot-test.com',
    }).returning();
    testOrgId = org.id;
    console.log('Created test organization:', testOrgId);

    // 2. Create a test member
    console.log('Creating test member...');
    await db.insert(profiles).values({
      id: testMemberId,
      email: 'member@snapshot-test.com',
      fullName: 'John Test',
      role: 'org_member',
      organizationId: testOrgId,
      mealBehaviorType: 'flexible',
    });
    console.log('Created test member');

    // 3. Create a test meal slot
    console.log('Creating test meal slot...');
    const [slot] = await db.insert(mealSlots).values({
      organizationId: testOrgId,
      name: 'Premium Lunch Slot',
      startTime: '12:00',
      endTime: '13:00',
      confirmationDeadline: '10:00',
      price: '15.75',
    }).returning();
    testSlotId = slot.id;
    console.log('Created test meal slot:', testSlotId);

    // 4. Create a confirmed meal confirmation
    console.log('Creating confirmed meal confirmation...');
    await db.insert(mealConfirmations).values({
      memberId: testMemberId,
      mealSlotId: testSlotId,
      date: '2026-05-01',
      status: 'confirmed',
      quantity: 2, // 2 meals
    });
    console.log('Created meal confirmation');

    // 5. Generate Invoice
    console.log('Generating invoice via billingService...');
    const invoice = await billingService.generateInvoice(testOrgId, '2026-05-01', '2026-05-07');
    testInvoiceId = invoice.id;
    console.log('Invoice generated:', testInvoiceId);
    console.log('Total Meals Count:', invoice.totalMealsCount);
    console.log('Total Amount:', invoice.totalAmount);

    // Verify invoice totals
    if (invoice.totalMealsCount !== 2) {
      throw new Error(`Expected totalMealsCount to be 2, got ${invoice.totalMealsCount}`);
    }
    if (parseFloat(invoice.totalAmount) !== 31.50) {
      throw new Error(`Expected totalAmount to be 31.50, got ${invoice.totalAmount}`);
    }

    // 6. Verify Billing Snapshot
    console.log('Verifying billing snapshots saved in database...');
    const snapshots = await db.select().from(billingSnapshots).where(eq(billingSnapshots.invoiceId, testInvoiceId));
    console.log('Snapshots retrieved:', snapshots);

    if (snapshots.length !== 1) {
      throw new Error(`Expected 1 snapshot, got ${snapshots.length}`);
    }

    const snap = snapshots[0];
    if (snap.mealSlotId !== testSlotId) {
      throw new Error(`Expected snapshot mealSlotId to be ${testSlotId}, got ${snap.mealSlotId}`);
    }
    if (snap.slotName !== 'Premium Lunch Slot') {
      throw new Error(`Expected snapshot slotName to be "Premium Lunch Slot", got "${snap.slotName}"`);
    }
    if (parseFloat(snap.unitPrice) !== 15.75) {
      throw new Error(`Expected snapshot unitPrice to be 15.75, got ${snap.unitPrice}`);
    }
    if (snap.totalQuantity !== 2) {
      throw new Error(`Expected snapshot totalQuantity to be 2, got ${snap.totalQuantity}`);
    }
    if (parseFloat(snap.totalAmount) !== 31.50) {
      throw new Error(`Expected snapshot totalAmount to be 31.50, got ${snap.totalAmount}`);
    }

    console.log('✅ BILLING SNAPSHOTS TEST PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ BILLING SNAPSHOTS TEST FAILED:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('Cleaning up test data...');
    try {
      if (testInvoiceId) {
        await db.delete(invoices).where(eq(invoices.id, testInvoiceId));
      }
      await db.delete(profiles).where(eq(profiles.id, testMemberId));
      if (testOrgId) {
        await db.delete(organizations).where(eq(organizations.id, testOrgId));
      }
      console.log('Cleanup complete.');
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
  }
}

async function testApi() {
  console.log('Testing tRPC API router integration...');
  try {
    const caller = appRouter.createCaller({
      user: { id: 'test-admin-id', email: 'admin@catering.com' } as any,
      dbUser: { id: 'test-admin-id', role: 'super_admin', organizationId: null } as any,
      db: db
    });

    console.log('Invoking caller.organization.getAll()...');
    const orgs = await caller.organization.getAll();
    console.log('API call successful!');
    console.log(`Retrieved ${orgs.length} organizations from DB:`);
    console.log(orgs);
  } catch (error) {
    console.error('API call execution failed:', error);
    process.exit(1);
  }
}

async function main() {
  await testApi();
  await testBillingSnapshots();
  process.exit(0);
}

main();
