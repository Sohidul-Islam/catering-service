import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { profiles } from './users';
import { mealSlots } from './meal_slots';

export const mealAdjustmentLogs = pgTable('meal_adjustment_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  performedById: text('performed_by_id').references(() => profiles.id, { onDelete: 'set null' }).notNull(),
  memberId: text('member_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  mealSlotId: uuid('meal_slot_id').references(() => mealSlots.id, { onDelete: 'cascade' }).notNull(),
  date: text('date').notNull(),
  actionType: text('action_type').notNull(), // e.g., 'override_confirm', 'override_skip'
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
