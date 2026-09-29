import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const merchantSaleDrafts = pgTable(
  "merchant_sale_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id").notNull(),
    status: text("status").notNull().default("active"),
    revision: integer("revision").notNull().default(1),
    currentStep: integer("current_step").notNull().default(0),
    customerLabel: text("customer_label"),
    itemCount: integer("item_count").notNull().default(0),
    content: jsonb("content").notNull(),
    conflicts: jsonb("conflicts").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("merchant_sale_drafts_tenant_status_updated_idx").on(
      table.tenantId,
      table.status,
      table.updatedAt,
    ),
  ],
);
