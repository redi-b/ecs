import {
  boolean,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants.js";

export const deliverySettings = pgTable(
  "delivery_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    deliveryEnabled: boolean("delivery_enabled").notNull().default(true),
    pickupEnabled: boolean("pickup_enabled").notNull().default(true),
    phoneConfirmationRequired: boolean("phone_confirmation_required").notNull().default(true),
    notesEnabled: boolean("notes_enabled").notNull().default(true),
    landmarkRequired: boolean("landmark_required").notNull().default(false),
    defaultDeliveryFee: numeric("default_delivery_fee").notNull().default("0"),
    currency: text("currency").notNull().default("ETB"),
    zones: jsonb("zones").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("delivery_settings_tenant_id_unique").on(table.tenantId)],
);
