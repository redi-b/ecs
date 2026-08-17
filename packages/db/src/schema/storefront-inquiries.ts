import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenants.js";

/** Customer messages submitted through any storefront template. */
export const storefrontInquiries = pgTable(
  "storefront_inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: text("type").notNull(),
    status: text("status").notNull().default("new"),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    details: jsonb("details").notNull().default({}),
    sourcePath: text("source_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("storefront_inquiries_tenant_status_created_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
  ],
);
