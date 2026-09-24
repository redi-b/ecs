import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { notificationStatus } from "./enums.js";
import { platformPrincipals } from "./platform-access.js";
import { tenants } from "./tenants.js";

/** Mutable operator workspace. Published email content is copied into an immutable version. */
export const emailTemplateDrafts = pgTable(
  "email_template_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateKey: text("template_key").notNull(),
    locale: text("locale").notNull(),
    subject: text("subject").notNull(),
    preheader: text("preheader").notNull().default(""),
    content: jsonb("content").notNull(),
    senderProfile: text("sender_profile").notNull(),
    replyTo: text("reply_to"),
    publishedVersion: integer("published_version"),
    createdByPrincipalId: uuid("created_by_principal_id").references(() => platformPrincipals.id),
    updatedByPrincipalId: uuid("updated_by_principal_id").references(() => platformPrincipals.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_template_drafts_key_locale_uidx").on(table.templateKey, table.locale),
    index("email_template_drafts_updated_idx").on(table.updatedAt),
  ],
);

/** Immutable publication history used for delivery and rollback. */
export const emailTemplateVersions = pgTable(
  "email_template_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateKey: text("template_key").notNull(),
    locale: text("locale").notNull(),
    version: integer("version").notNull(),
    subject: text("subject").notNull(),
    preheader: text("preheader").notNull().default(""),
    content: jsonb("content").notNull(),
    senderProfile: text("sender_profile").notNull(),
    replyTo: text("reply_to"),
    publishedByPrincipalId: uuid("published_by_principal_id").references(
      () => platformPrincipals.id,
    ),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_template_versions_key_locale_version_uidx").on(
      table.templateKey,
      table.locale,
      table.version,
    ),
    index("email_template_versions_published_idx").on(table.publishedAt),
  ],
);

/** Durable delivery ledger. Sensitive template variables are encrypted by platform-api. */
export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    templateKey: text("template_key").notNull(),
    templateVersion: integer("template_version"),
    locale: text("locale").notNull(),
    recipient: text("recipient").notNull(),
    senderProfile: text("sender_profile").notNull(),
    variablesEncrypted: text("variables_encrypted").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: notificationStatus("status").notNull().default("pending"),
    providerReference: text("provider_reference"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("email_deliveries_idempotency_uidx").on(table.idempotencyKey),
    index("email_deliveries_status_created_idx").on(table.status, table.createdAt),
    index("email_deliveries_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);
