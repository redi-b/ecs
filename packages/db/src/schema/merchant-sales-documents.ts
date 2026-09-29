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
import { tenants } from "./tenants";

export const merchantSalesDocumentCounters = pgTable("merchant_sales_document_counters", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  nextNumber: integer("next_number").notNull().default(1),
});

export const merchantSalesDocuments = pgTable(
  "merchant_sales_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: text("order_id").notNull(),
    number: text("number").notNull(),
    kind: text("kind").notNull(),
    language: text("language").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    contentHash: text("content_hash").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("merchant_sales_documents_tenant_number_uidx").on(table.tenantId, table.number),
    index("merchant_sales_documents_tenant_order_idx").on(
      table.tenantId,
      table.orderId,
      table.createdAt,
    ),
  ],
);
