import { pgTable, text, timestamp, uuid, numeric, integer, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'overdue']);

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  billingPeriodStart: text('billing_period_start').notNull(), // format 'YYYY-MM-DD'
  billingPeriodEnd: text('billing_period_end').notNull(), // format 'YYYY-MM-DD'
  totalMealsCount: integer('total_meals_count').notNull(),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  adjustmentAmount: numeric('adjustment_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  discountAmount: numeric('discount_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  taxAmount: numeric('tax_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  status: invoiceStatusEnum('status').default('draft').notNull(),
  pdfUrl: text('pdf_url'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
