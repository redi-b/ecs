import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { platformPrincipals } from "./platform-access.js";
import { tenants } from "./tenants.js";

export const operatorNotes = pgTable("operator_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  operatorUserId: text("operator_user_id").notNull(),
  body: text("body").notNull(),
  visibility: text("visibility").notNull().default("internal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correlationId: uuid("correlation_id").notNull().defaultRandom(),
    outcome: text("outcome").notNull().default("completed"),
    actorUserId: text("actor_user_id"),
    platformPrincipalId: uuid("platform_principal_id").references(() => platformPrincipals.id),
    tenantId: uuid("tenant_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_correlation_idx").on(table.correlationId)],
);
