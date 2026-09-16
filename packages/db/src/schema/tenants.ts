import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { tenantStatus } from "./enums.js";

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("organizations_slug_uidx").on(table.slug)],
);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" })
    .unique(),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
  // Nullable for existing shops: never infer public contacts from private accounts.
  shopDetails: jsonb("shop_details"),
  status: tenantStatus("status").notNull().default("draft"),
  primaryDomainId: uuid("primary_domain_id"),
  planId: uuid("plan_id"),
  medusaStoreId: text("medusa_store_id"),
  medusaSalesChannelId: text("medusa_sales_channel_id"),
  medusaPublishableKeyId: text("medusa_publishable_key_id"),
  medusaStockLocationId: text("medusa_stock_location_id"),
  medusaRegionId: text("medusa_region_id"),
  medusaShippingProfileId: text("medusa_shipping_profile_id"),
  medusaFulfillmentSetId: text("medusa_fulfillment_set_id"),
  medusaServiceZoneId: text("medusa_service_zone_id"),
  medusaShippingOptionId: text("medusa_shipping_option_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [organizations.id],
    references: [tenants.organizationId],
  }),
}));

export const tenantsRelations = relations(tenants, ({ one }) => ({
  organization: one(organizations, {
    fields: [tenants.organizationId],
    references: [organizations.id],
  }),
}));

export const reservedHandles = pgTable("reserved_handles", {
  id: uuid("id").primaryKey().defaultRandom(),
  handle: text("handle").notNull().unique(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
