import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './users';
import { organizations } from './organizations';

export const memberLeaves = pgTable('member_leaves', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: text('member_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  startDate: text('start_date').notNull(), // format 'YYYY-MM-DD'
  endDate: text('end_date').notNull(),     // format 'YYYY-MM-DD'
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
