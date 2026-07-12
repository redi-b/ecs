import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth.js";
import { mediaAccessMode, mediaAssetStatus, mediaResourceType } from "./enums.js";
import { tenants } from "./tenants.js";

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    storageProvider: text("storage_provider").notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    displayName: text("display_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    accessMode: mediaAccessMode("access_mode").notNull().default("public"),
    publicUrl: text("public_url"),
    status: mediaAssetStatus("status").notNull().default("pending"),
    altText: text("alt_text"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("media_assets_tenant_created_at_idx").on(table.tenantId, table.createdAt),
    index("media_assets_tenant_status_idx").on(table.tenantId, table.status),
    index("media_assets_tenant_mime_type_idx").on(table.tenantId, table.mimeType),
    index("media_assets_tenant_access_mode_idx").on(table.tenantId, table.accessMode),
    uniqueIndex("media_assets_tenant_object_key_unique").on(table.tenantId, table.objectKey),
  ],
);

export const mediaUsages = pgTable(
  "media_usages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    resourceType: mediaResourceType("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    field: text("field").notNull(),
    position: integer("position").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("media_usages_tenant_resource_idx").on(
      table.tenantId,
      table.resourceType,
      table.resourceId,
    ),
    index("media_usages_asset_id_idx").on(table.mediaAssetId),
    index("media_usages_resource_position_idx").on(
      table.tenantId,
      table.resourceType,
      table.resourceId,
      table.field,
      table.position,
    ),
  ],
);
