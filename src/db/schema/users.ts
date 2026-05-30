import { pgTable, text, timestamp, pgEnum, uuid, boolean } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const roleEnum = pgEnum('user_role', ['super_admin', 'org_admin', 'org_member']);
export const mealBehaviorTypeEnum = pgEnum('meal_behavior_type', ['recurring', 'flexible']);

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(), // references Supabase auth.users.id
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  phoneNumber: text('phone_number'),
  role: roleEnum('role').default('org_member').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  mealBehaviorType: mealBehaviorTypeEnum('meal_behavior_type').default('flexible').notNull(),
  departmentId: uuid('department_id'), // soft ref — no FK to avoid circular dep
  officeLocationId: uuid('office_location_id'), // soft ref — no FK to avoid circular dep
  isActive: boolean('is_active').default(true).notNull(), // soft delete flag
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  leftAt: timestamp('left_at'), // null means still active
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
