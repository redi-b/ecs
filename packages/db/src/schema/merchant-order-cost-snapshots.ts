import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const merchantOrderCostSnapshots = pgTable(
  "merchant_order_cost_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: text("order_id").notNull(),
    lineItemId: text("line_item_id").notNull(),
    variantId: text("variant_id"),
    quantity: integer("quantity").notNull(),
    unitCostAmount: integer("unit_cost_amount"),
    currencyCode: text("currency_code").notNull().default("etb"),
    orderPlacedAt: timestamp("order_placed_at", { withTimezone: true }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("merchant_order_cost_snapshots_line_uidx").on(
      table.tenantId,
      table.orderId,
      table.lineItemId,
    ),
    index("merchant_order_cost_snapshots_tenant_order_idx").on(table.tenantId, table.orderId),
    index("merchant_order_cost_snapshots_tenant_placed_idx").on(
      table.tenantId,
      table.orderPlacedAt,
    ),
  ],
);
