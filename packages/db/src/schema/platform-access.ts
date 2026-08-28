import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.js";

export const platformPrincipals = pgTable(
  "platform_principals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("platform_principals_user_id_unique").on(table.userId)],
);

export const platformPermissionGrants = pgTable(
  "platform_permission_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    principalId: uuid("principal_id")
      .notNull()
      .references(() => platformPrincipals.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("platform_permission_grants_principal_permission_unique").on(
      table.principalId,
      table.permission,
    ),
    index("platform_permission_grants_principal_idx").on(table.principalId),
  ],
);
