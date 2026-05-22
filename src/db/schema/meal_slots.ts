import { pgTable, text, timestamp, uuid, numeric, boolean, integer } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const mealSlots = pgTable('meal_slots', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(), // e.g., 'Breakfast', 'Lunch', 'Dinner', 'Snacks'
  startTime: text('start_time').notNull(), // e.g., '08:00'
  endTime: text('end_time').notNull(), // e.g., '09:00'
  confirmationDeadline: text('confirmation_deadline').notNull(), // e.g., '22:00'
  deadlineDaysAhead: integer('deadline_days_ahead').default(0).notNull(), // 0 = same day, 1 = day before
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
