import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenants.js";

export type ProductOptionSetValue = {
  displayMode?: "text" | "swatch";
  label: string;
  swatch?: { kind: "color"; value: string } | { kind: "image"; url: string } | null;
};

/** Merchant-owned option values that can be copied into multiple products. */
export const productOptionSets = pgTable(
  "product_option_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    title: text("title").notNull(),
    values: jsonb("values").$type<ProductOptionSetValue[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("product_option_sets_tenant_idx").on(table.tenantId),
    uniqueIndex("product_option_sets_tenant_title_uidx").on(table.tenantId, table.title),
  ],
);
