import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenants.js";

/** Tenant-scoped customer continuity that Medusa does not model as storefront preferences. */
export const customerCommerceStates = pgTable(
  "customer_commerce_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    medusaCustomerId: text("medusa_customer_id").notNull(),
    activeCartId: text("active_cart_id"),
    wishlist: jsonb("wishlist").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("customer_commerce_states_tenant_customer_unique").on(
      table.tenantId,
      table.medusaCustomerId,
    ),
  ],
);
