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

/** Immutable merchant-reviewed input and normalized plan. Execution state lives separately. */
export const productImportArtifacts = pgTable(
  "product_import_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    createdByUserId: text("created_by_user_id").notNull(),
    schemaVersion: text("schema_version").notNull(),
    contentDigest: text("content_digest").notNull(),
    csv: text("csv").notNull(),
    writePlan: jsonb("write_plan").notNull(),
    summary: jsonb("summary").notNull(),
    status: text("status").notNull().default("reviewed"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("product_import_artifacts_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("product_import_artifacts_tenant_digest_idx").on(table.tenantId, table.contentDigest),
    index("product_import_artifacts_expires_idx").on(table.expiresAt),
  ],
);

export const productImportExecutions = pgTable(
  "product_import_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => productImportArtifacts.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    requestedByUserId: text("requested_by_user_id").notNull(),
    contentDigest: text("content_digest").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("pending_enqueue"),
    jobRunId: uuid("job_run_id"),
    cursor: integer("cursor").notNull().default(0),
    totalProducts: integer("total_products").notNull(),
    succeededProducts: integer("succeeded_products").notNull().default(0),
    failedProducts: integer("failed_products").notNull().default(0),
    error: text("error"),
    queuedAt: timestamp("queued_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_import_executions_tenant_idempotency_uidx").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("product_import_executions_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("product_import_executions_status_updated_idx").on(table.status, table.updatedAt),
    index("product_import_executions_artifact_idx").on(table.artifactId),
  ],
);

export const productImportOutcomes = pgTable(
  "product_import_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => productImportExecutions.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    productKey: text("product_key").notNull(),
    sourceRows: jsonb("source_rows").notNull(),
    status: text("status").notNull().default("pending"),
    productId: text("product_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_import_outcomes_execution_product_uidx").on(
      table.executionId,
      table.productKey,
    ),
    index("product_import_outcomes_execution_status_idx").on(table.executionId, table.status),
    index("product_import_outcomes_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);
