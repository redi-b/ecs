import { bigint, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth.js";
import { mediaAssetStatus } from "./enums.js";

/** Platform-owned public media used by shared catalog content, never merchant libraries. */
export const platformAssets = pgTable(
  "platform_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storageProvider: text("storage_provider").notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    publicUrl: text("public_url"),
    status: mediaAssetStatus("status").notNull().default("pending"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("platform_assets_object_key_unique").on(table.objectKey)],
);
