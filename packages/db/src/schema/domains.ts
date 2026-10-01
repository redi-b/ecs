import { sql } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenants.js";

export const domains = pgTable(
  "domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hostname: text("hostname").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    verificationStatus: text("verification_status").notNull().default("pending"),
    sslStatus: text("ssl_status").notNull().default("pending"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    warningSince: timestamp("warning_since", { withTimezone: true }),
    warningReason: text("warning_reason"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastCheckReason: text("last_check_reason"),
    lastCheckDetail: text("last_check_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("domains_live_hostname_unique")
      .on(table.hostname)
      .where(sql`${table.removedAt} is null`),
  ],
);

export const domainVerificationChallenges = pgTable("domain_verification_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => domains.id),
  recordName: text("record_name").notNull(),
  recordValue: text("record_value").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const domainLifecycleEvents = pgTable("domain_lifecycle_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => domains.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  event: text("event").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
