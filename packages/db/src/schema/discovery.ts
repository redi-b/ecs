import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const dashboardDiscoveryCampaigns = pgTable(
  "dashboard_discovery_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    status: text("status").notNull().default("draft"),
    content: jsonb("content").notNull().default({}),
    action: jsonb("action").notNull().default({}),
    targeting: jsonb("targeting").notNull().default({}),
    priority: integer("priority").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    cooldownHours: integer("cooldown_hours").notNull().default(168),
    snoozeDays: integer("snooze_days").notNull().default(30),
    maxImpressions: integer("max_impressions"),
    createdByUserId: text("created_by_user_id"),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("dashboard_discovery_campaigns_key_uidx").on(table.key)],
);

export const dashboardDiscoveryEvents = pgTable(
  "dashboard_discovery_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => dashboardDiscoveryCampaigns.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id"),
    event: text("event").notNull(),
    idempotencyKey: text("idempotency_key"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("dashboard_discovery_events_tenant_campaign_idx").on(table.tenantId, table.campaignId),
    index("dashboard_discovery_events_campaign_event_idx").on(table.campaignId, table.event),
    uniqueIndex("dashboard_discovery_events_idempotency_key_uidx").on(table.idempotencyKey),
  ],
);
