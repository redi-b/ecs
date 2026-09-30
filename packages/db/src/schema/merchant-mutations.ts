import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const merchantMutationExecutions = pgTable(
  "merchant_mutation_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    source: text("source").notNull(),
    requestId: text("request_id").notNull(),
    state: text("state").notNull().default("processing"),
    result: jsonb("result"),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("merchant_mutation_tenant_operation_key_uidx").on(
      table.tenantId,
      table.operation,
      table.idempotencyKey,
    ),
    index("merchant_mutation_tenant_state_idx").on(table.tenantId, table.state),
  ],
);

export const merchantMutationLocks = pgTable(
  "merchant_mutation_locks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    resourceKey: text("resource_key").notNull(),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("merchant_mutation_lock_tenant_resource_uidx").on(
      table.tenantId,
      table.resourceKey,
    ),
    index("merchant_mutation_lock_tenant_key_idx").on(
      table.tenantId,
      table.operation,
      table.idempotencyKey,
    ),
  ],
);
