import { pgTable, text, timestamp, uuid, integer, pgEnum, boolean, numeric } from 'drizzle-orm/pg-core';
import { profiles } from './users';
import { mealSlots } from './meal_slots';

export const confirmationStatusEnum = pgEnum('confirmation_status', ['confirmed', 'skipped', 'pending']);

export const mealConfirmations = pgTable('meal_confirmations', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: text('member_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  mealSlotId: uuid('meal_slot_id').references(() => mealSlots.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(), // format 'YYYY-MM-DD'
  status: confirmationStatusEnum('status').default('pending').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  price: numeric('price', { precision: 10, scale: 2 }), // Price at booking time (nullable if not yet snapshotted)
  isOverridden: boolean('is_overridden').default(false).notNull(),
  overriddenById: text('overridden_by_id').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
