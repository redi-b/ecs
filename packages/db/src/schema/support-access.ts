import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth.js";
import { platformPrincipals } from "./platform-access.js";
import { tenants } from "./tenants.js";

export const tenantSupportAccessGrants = pgTable(
  "tenant_support_access_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    platformPrincipalId: uuid("platform_principal_id")
      .notNull()
      .references(() => platformPrincipals.id, { onDelete: "cascade" }),
    operatorUserId: text("operator_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: text("revoked_by_user_id").references(() => users.id),
    revokeReason: text("revoke_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tenant_support_access_grants_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("tenant_support_access_grants_operator_expiry_idx").on(
      table.operatorUserId,
      table.expiresAt,
    ),
  ],
);
