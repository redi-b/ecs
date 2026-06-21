import { jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { analyticsSource } from "./enums.js";
import { tenants } from "./tenants.js";

export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  eventType: text("event_type").notNull(),
  source: analyticsSource("source").notNull(),
  subjectType: text("subject_type"),
  subjectId: text("subject_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  idempotencyKey: text("idempotency_key"),
  sessionIdHash: text("session_id_hash"),
  customerId: text("customer_id"),
  properties: jsonb("properties").notNull().default({}),
});

export const dailyMetrics = pgTable("daily_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  date: text("date").notNull(),
  metricKey: text("metric_key").notNull(),
  dimensionKey: text("dimension_key"),
  dimensionValue: text("dimension_value"),
  value: numeric("value").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});
