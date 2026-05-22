import { relations } from 'drizzle-orm';
import { organizations } from '../schema/organizations';
import { profiles } from '../schema/users';
import { mealSlots } from '../schema/meal_slots';
import { recurringPreferences } from '../schema/recurring_preferences';
import { mealConfirmations } from '../schema/confirmations';
import { invoices } from '../schema/invoices';
import { mealAdjustmentLogs } from '../schema/logs';
import { notifications } from '../schema/notifications';

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(profiles),
  slots: many(mealSlots),
  invoices: many(invoices),
  logs: many(mealAdjustmentLogs),
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

export const invoicesRelations = relations(invoices, ({ one }) => ({
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
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
