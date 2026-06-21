import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { notificationStatus } from "./enums.js";
import { tenants } from "./tenants.js";

export const paymentOnboarding = pgTable("payment_onboarding", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  requiredDocuments: jsonb("required_documents").notNull().default([]),
  notes: text("notes"),
  providerAccountRef: text("provider_account_ref"),
});

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  channel: text("channel").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  target: text("target").notNull(),
  events: jsonb("events").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  eventType: text("event_type").notNull(),
  channel: text("channel").notNull(),
  recipient: text("recipient").notNull(),
  status: notificationStatus("status").notNull().default("pending"),
  providerReference: text("provider_reference"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});
