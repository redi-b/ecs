import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenants.js";

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  hostname: text("hostname").notNull().unique(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  verificationStatus: text("verification_status").notNull().default("pending"),
  sslStatus: text("ssl_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
