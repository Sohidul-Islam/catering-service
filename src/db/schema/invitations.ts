import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { roleEnum } from './users';
import { organizations } from './organizations';

export const invitations = pgTable('invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: roleEnum('role').default('org_member').notNull(),
  status: text('status').default('pending').notNull(), // 'pending', 'accepted', 'declined'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
