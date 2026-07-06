import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { tenantStatus } from "./enums.js";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
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

export const reservedHandles = pgTable("reserved_handles", {
  id: uuid("id").primaryKey().defaultRandom(),
  handle: text("handle").notNull().unique(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
