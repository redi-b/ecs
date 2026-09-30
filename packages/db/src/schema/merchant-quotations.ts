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

export const merchantQuotationCounters = pgTable("merchant_quotation_counters", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  nextNumber: integer("next_number").notNull().default(1),
});

export const merchantQuotations = pgTable(
  "merchant_quotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    status: text("status").notNull().default("issued"),
    currentRevision: integer("current_revision").notNull().default(1),
    convertedOrderId: text("converted_order_id"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("merchant_quotations_tenant_number_uidx").on(table.tenantId, table.number),
    index("merchant_quotations_tenant_updated_idx").on(table.tenantId, table.updatedAt),
  ],
);

export const merchantQuotationRevisions = pgTable(
  "merchant_quotation_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => merchantQuotations.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("merchant_quotation_revisions_quote_revision_uidx").on(
      table.quotationId,
      table.revision,
    ),
    index("merchant_quotation_revisions_tenant_quote_idx").on(table.tenantId, table.quotationId),
  ],
);
