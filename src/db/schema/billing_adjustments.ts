import { pgTable, text, timestamp, uuid, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { invoices } from './invoices';
import { profiles } from './users';

export const adjustmentTypeEnum = pgEnum('adjustment_type', ['credit', 'debit', 'discount', 'refund', 'tax']);

export const billingAdjustments = pgTable('billing_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  type: adjustmentTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  createdById: text('created_by_id').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
