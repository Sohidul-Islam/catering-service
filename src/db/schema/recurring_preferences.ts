import { pgTable, timestamp, uuid, integer, text } from 'drizzle-orm/pg-core';
import { profiles } from './users';
import { mealSlots } from './meal_slots';

export const recurringPreferences = pgTable('recurring_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: text('member_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  mealSlotId: uuid('meal_slot_id').references(() => mealSlots.id, { onDelete: 'cascade' }).notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  quantity: integer('quantity').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
