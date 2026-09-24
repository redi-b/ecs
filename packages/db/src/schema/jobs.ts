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
import { sql } from "drizzle-orm";

import { jobRunStatus } from "./enums.js";
import { tenants } from "./tenants.js";

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    name: text("name").notNull(),
    status: jobRunStatus("status").notNull().default("queued"),
    payload: jsonb("payload").notNull().default({}),
    result: jsonb("result"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    idempotencyKey: text("idempotency_key"),
    bullmqJobId: text("bullmq_job_id"),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_runs_status_created_at_idx").on(table.status, table.createdAt),
    index("job_runs_tenant_created_at_idx").on(table.tenantId, table.createdAt),
    index("job_runs_name_created_at_idx").on(table.name, table.createdAt),
    uniqueIndex("job_runs_name_idempotency_key_uidx")
      .on(table.name, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
  ],
);
