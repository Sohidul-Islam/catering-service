import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles, roleEnum } from './users';
import { organizations } from './organizations';

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: roleEnum('role').default('org_member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
