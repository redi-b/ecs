import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const merchantInventoryMovements = pgTable(
  "merchant_inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id").notNull(),
    locationId: text("location_id").notNull(),
    productId: text("product_id"),
    variantId: text("variant_id"),
    delta: integer("delta").notNull(),
    observedBefore: integer("observed_before"),
    observedAfter: integer("observed_after"),
    reason: text("reason").notNull(),
    note: text("note"),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    actorUserId: text("actor_user_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("merchant_inventory_movements_source_uidx").on(
      table.tenantId,
      table.sourceType,
      table.sourceId,
      table.inventoryItemId,
      table.locationId,
    ),
    index("merchant_inventory_movements_tenant_item_idx").on(
      table.tenantId,
      table.inventoryItemId,
      table.locationId,
      table.occurredAt,
    ),
    index("merchant_inventory_movements_tenant_variant_idx").on(
      table.tenantId,
      table.productId,
      table.variantId,
      table.occurredAt,
    ),
  ],
);
