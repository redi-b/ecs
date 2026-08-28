import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { analyticsSource } from "./enums.js";
import { tenants } from "./tenants.js";

export const analyticsEvents = pgTable(
  "analytics_events",
  {
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
  },
  (table) => [
    uniqueIndex("analytics_events_tenant_source_idempotency_key_idx").on(
      table.tenantId,
      table.source,
      table.idempotencyKey,
    ),
  ],
);

export const dailyMetrics = pgTable(
  "daily_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    date: text("date").notNull(),
    metricKey: text("metric_key").notNull(),
    dimensionKey: text("dimension_key").notNull().default(""),
    dimensionValue: text("dimension_value").notNull().default(""),
    value: numeric("value").notNull(),
    currencyCode: text("currency_code").notNull().default(""),
    timezone: text("timezone").notNull().default("Africa/Addis_Ababa"),
    rollupVersion: integer("rollup_version").notNull().default(1),
    sourceWindowStart: timestamp("source_window_start", { withTimezone: true }),
    sourceWindowEnd: timestamp("source_window_end", { withTimezone: true }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("daily_metrics_logical_bucket_uidx").on(
      table.tenantId,
      table.date,
      table.metricKey,
      table.dimensionKey,
      table.dimensionValue,
      table.currencyCode,
      table.rollupVersion,
    ),
    index("daily_metrics_tenant_date_idx").on(table.tenantId, table.date),
  ],
);

export const metricRollupCheckpoints = pgTable(
  "metric_rollup_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    rollupKey: text("rollup_key").notNull(),
    rollupVersion: integer("rollup_version").notNull(),
    timezone: text("timezone").notNull(),
    watermark: timestamp("watermark", { withTimezone: true }).notNull(),
    lastSuccessfulAt: timestamp("last_successful_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("metric_rollup_checkpoints_tenant_key_version_uidx").on(
      table.tenantId,
      table.rollupKey,
      table.rollupVersion,
    ),
  ],
);
