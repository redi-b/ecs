import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { notificationStatus, telegramConnectSessionStatus } from "./enums.js";
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
  /** Event context at record time for async delivery rendering (no secrets). */
  payload: jsonb("payload").notNull().default({}),
  providerReference: text("provider_reference"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

/**
 * Multi-endpoint notification destinations (Telegram first; email may migrate later).
 * Delivery fan-out for telegram uses this table; email still uses notification_preferences.
 */
export const notificationDestinations = pgTable(
  "notification_destinations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    channel: text("channel").notNull(),
    /** Opaque send key: Telegram chat_id, etc. Never show as primary UI. */
    target: text("target").notNull(),
    /** Merchant-facing label, e.g. @username or first name. */
    label: text("label").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    events: jsonb("events").notNull().default([]),
    metadata: jsonb("metadata").notNull().default({}),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_destinations_tenant_channel_target_uidx").on(
      table.tenantId,
      table.channel,
      table.target,
    ),
    index("notification_destinations_tenant_channel_idx").on(table.tenantId, table.channel),
  ],
);

export const telegramConnectSessions = pgTable(
  "telegram_connect_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    createdByUserId: text("created_by_user_id").notNull(),
    status: telegramConnectSessionStatus("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("telegram_connect_sessions_token_uidx").on(table.token),
    index("telegram_connect_sessions_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

/**
 * Dashboard inbox items (in-app notifications).
 * userId null = tenant-wide (v1); later personal rows set userId.
 * Separate from notification_logs (external delivery ledger).
 */
export const inAppNotifications = pgTable(
  "in_app_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** Better Auth user id when personal; null = visible to all shop members. */
    userId: text("user_id"),
    eventType: text("event_type").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    payload: jsonb("payload").notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("in_app_notifications_tenant_dedupe_uidx").on(table.tenantId, table.dedupeKey),
    index("in_app_notifications_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("in_app_notifications_tenant_unread_idx").on(table.tenantId, table.readAt),
  ],
);
