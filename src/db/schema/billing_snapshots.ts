import { pgTable, text, timestamp, uuid, numeric, integer } from 'drizzle-orm/pg-core';
import { invoices } from './invoices';
import { mealSlots } from './meal_slots';

export const billingSnapshots = pgTable('billing_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  mealSlotId: uuid('meal_slot_id').references(() => mealSlots.id, { onDelete: 'cascade' }).notNull(),
  slotName: text('slot_name').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalQuantity: integer('total_quantity').notNull(),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
