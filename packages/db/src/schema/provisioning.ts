import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenants.js";

export const tenantProvisioningAttempts = pgTable(
  "tenant_provisioning_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    platformTenantId: uuid("platform_tenant_id").notNull(),
    handle: text("handle").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    step: text("step").notNull(),
    status: text("status").notNull(),
    error: text("error"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("tenant_provisioning_attempts_tenant_id_created_at_idx").on(
      table.tenantId,
      table.createdAt,
    ),
    index("tenant_provisioning_attempts_platform_tenant_id_idx").on(table.platformTenantId),
    index("tenant_provisioning_attempts_owner_handle_idx").on(table.ownerUserId, table.handle),
  ],
);
