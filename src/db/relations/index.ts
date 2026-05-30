import { relations } from 'drizzle-orm';
import { organizations } from '../schema/organizations';
import { profiles } from '../schema/users';
import { mealSlots } from '../schema/meal_slots';
import { recurringPreferences } from '../schema/recurring_preferences';
import { mealConfirmations } from '../schema/confirmations';
import { invoices } from '../schema/invoices';
import { mealAdjustmentLogs } from '../schema/logs';
import { notifications } from '../schema/notifications';
import { holidays } from '../schema/holidays';
import { departments } from '../schema/departments';
import { officeLocations } from '../schema/office_locations';
import { billingAdjustments } from '../schema/billing_adjustments';
import { memberLeaves } from '../schema/member_leaves';
import { organizationMembers } from '../schema/organization_members';
import { invitations } from '../schema/invitations';

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(profiles),
  slots: many(mealSlots),
  invoices: many(invoices),
  logs: many(mealAdjustmentLogs),
  holidays: many(holidays),
  departments: many(departments),
  officeLocations: many(officeLocations),
  memberLeaves: many(memberLeaves),
  organizationMembers: many(organizationMembers),
  invitations: many(invitations),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [profiles.organizationId],
    references: [organizations.id],
  }),
  confirmations: many(mealConfirmations),
  preferences: many(recurringPreferences),
  performedLogs: many(mealAdjustmentLogs, { relationName: 'performedLogs' }),
  receivedLogs: many(mealAdjustmentLogs, { relationName: 'receivedLogs' }),
  notifications: many(notifications),
  leaves: many(memberLeaves),
}));

export const mealSlotsRelations = relations(mealSlots, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [mealSlots.organizationId],
    references: [organizations.id],
  }),
  confirmations: many(mealConfirmations),
  preferences: many(recurringPreferences),
  logs: many(mealAdjustmentLogs),
}));

export const recurringPreferencesRelations = relations(recurringPreferences, ({ one }) => ({
  member: one(profiles, {
    fields: [recurringPreferences.memberId],
    references: [profiles.id],
  }),
  slot: one(mealSlots, {
    fields: [recurringPreferences.mealSlotId],
    references: [mealSlots.id],
  }),
}));

export const mealConfirmationsRelations = relations(mealConfirmations, ({ one }) => ({
  member: one(profiles, {
    fields: [mealConfirmations.memberId],
    references: [profiles.id],
  }),
  slot: one(mealSlots, {
    fields: [mealConfirmations.mealSlotId],
    references: [mealSlots.id],
  }),
  overrideBy: one(profiles, {
    fields: [mealConfirmations.overriddenById],
    references: [profiles.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
  }),
  adjustments: many(billingAdjustments),
}));

export const billingAdjustmentsRelations = relations(billingAdjustments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [billingAdjustments.invoiceId],
    references: [invoices.id],
  }),
  createdBy: one(profiles, {
    fields: [billingAdjustments.createdById],
    references: [profiles.id],
  }),
}));

export const mealAdjustmentLogsRelations = relations(mealAdjustmentLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [mealAdjustmentLogs.organizationId],
    references: [organizations.id],
  }),
  performer: one(profiles, {
    fields: [mealAdjustmentLogs.performedById],
    references: [profiles.id],
    relationName: 'performedLogs',
  }),
  member: one(profiles, {
    fields: [mealAdjustmentLogs.memberId],
    references: [profiles.id],
    relationName: 'receivedLogs',
  }),
  slot: one(mealSlots, {
    fields: [mealAdjustmentLogs.mealSlotId],
    references: [mealSlots.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(profiles, {
    fields: [notifications.userId],
    references: [profiles.id],
  }),
}));

export const holidaysRelations = relations(holidays, ({ one }) => ({
  organization: one(organizations, {
    fields: [holidays.organizationId],
    references: [organizations.id],
  }),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [departments.organizationId],
    references: [organizations.id],
  }),
  members: many(profiles),
}));

export const officeLocationsRelations = relations(officeLocations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [officeLocations.organizationId],
    references: [organizations.id],
  }),
  members: many(profiles),
}));

export const memberLeavesRelations = relations(memberLeaves, ({ one }) => ({
  member: one(profiles, {
    fields: [memberLeaves.memberId],
    references: [profiles.id],
  }),
  organization: one(organizations, {
    fields: [memberLeaves.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  profile: one(profiles, {
    fields: [organizationMembers.profileId],
    references: [profiles.id],
  }),
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
}));

