import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { templateStatus } from "./enums.js";
import { tenants } from "./tenants.js";

export const storefrontTemplates = pgTable("storefront_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  status: templateStatus("status").notNull().default("draft"),
  previewAssetId: text("preview_asset_id"),
  tags: jsonb("tags").notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  minimumPlanId: uuid("minimum_plan_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storefrontTemplateVersions = pgTable("storefront_template_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => storefrontTemplates.id),
  version: integer("version").notNull(),
  templateKey: text("template_key").notNull().unique(),
  schema: jsonb("schema").notNull(),
  defaultData: jsonb("default_data").notNull(),
  defaultThemeTokens: jsonb("default_theme_tokens").notNull(),
  previewData: jsonb("preview_data").notNull().default({}),
  componentRegistryVersion: text("component_registry_version").notNull(),
  sourceHash: text("source_hash").notNull(),
  status: templateStatus("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storefrontConfigs = pgTable("storefront_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  draftTemplateId: uuid("draft_template_id"),
  draftTemplateVersion: integer("draft_template_version"),
  draftData: jsonb("draft_data").notNull().default({}),
  draftThemeTokens: jsonb("draft_theme_tokens").notNull().default({}),
  publishedRevisionId: uuid("published_revision_id"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storefrontRevisions = pgTable("storefront_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  templateId: uuid("template_id").notNull(),
  templateVersion: integer("template_version").notNull(),
  templateKey: text("template_key").notNull(),
  data: jsonb("data").notNull(),
  themeTokens: jsonb("theme_tokens").notNull(),
  publishedByUserId: text("published_by_user_id"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
