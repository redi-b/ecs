import { date, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const merchantExpenses = pgTable(
  "merchant_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    currencyCode: text("currency_code").notNull().default("etb"),
    category: text("category").notNull(),
    occurredOn: date("occurred_on").notNull(),
    vendorLabel: text("vendor_label"),
    reference: text("reference"),
    note: text("note"),
    status: text("status").notNull().default("active"),
    actorUserId: text("actor_user_id").notNull(),
    voidedByUserId: text("voided_by_user_id"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("merchant_expenses_tenant_occurred_idx").on(table.tenantId, table.occurredOn),
    index("merchant_expenses_tenant_status_idx").on(table.tenantId, table.status),
  ],
);
