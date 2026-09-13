import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { subscriptionStatus } from "./enums.js";
import { tenants } from "./tenants.js";

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().default(sql`gen_random_uuid()::text`),
    name: text("name").notNull(),
    price: numeric("price").notNull(),
    limits: jsonb("limits").notNull().default({}),
    features: jsonb("features").notNull().default({}),
    kind: text("kind").notNull().default("standard"),
    visibility: text("visibility").notNull().default("private"),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    basePlanVersionId: uuid("base_plan_version_id").references((): AnyPgColumn => planVersions.id),
    status: text("status").notNull().default("active"),
  },
  (table) => [
    uniqueIndex("plans_code_unique").on(table.code),
    index("plans_catalog_idx").on(table.status, table.visibility, table.kind),
    index("plans_tenant_id_idx").on(table.tenantId),
    check("plans_kind_valid", sql`${table.kind} in ('standard', 'custom')`),
    check("plans_visibility_valid", sql`${table.visibility} in ('public', 'private')`),
    check("plans_status_valid", sql`${table.status} in ('draft', 'active', 'archived')`),
    check(
      "plans_custom_scope_valid",
      sql`(${table.kind} = 'standard' and ${table.tenantId} is null) or (${table.kind} = 'custom' and ${table.tenantId} is not null)`,
    ),
  ],
);

/**
 * Published commercial terms are append-only. `plans` remains the stable plan
 * identity while subscriptions pin the exact version they accepted.
 */
export const planVersions = pgTable(
  "plan_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    version: integer("version").notNull(),
    fingerprint: text("fingerprint").notNull(),
    name: text("name").notNull(),
    price: numeric("price").notNull(),
    currency: text("currency").notNull().default("ETB"),
    billingInterval: text("billing_interval").notNull().default("month"),
    limits: jsonb("limits").notNull().default({}),
    features: jsonb("features").notNull().default({}),
    trialPolicy: jsonb("trial_policy").notNull().default({}),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plan_versions_plan_id_version_unique").on(table.planId, table.version),
    uniqueIndex("plan_versions_plan_id_fingerprint_unique").on(table.planId, table.fingerprint),
  ],
);

/** One mutable authoring workspace per stable plan; publishing consumes the draft. */
export const planDrafts = pgTable(
  "plan_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    revision: integer("revision").notNull().default(1),
    name: text("name").notNull(),
    price: numeric("price").notNull(),
    currency: text("currency").notNull().default("ETB"),
    billingInterval: text("billing_interval").notNull().default("month"),
    limits: jsonb("limits").notNull().default({}),
    features: jsonb("features").notNull().default({}),
    trialPolicy: jsonb("trial_policy").notNull().default({}),
    updatedByUserId: text("updated_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("plan_drafts_plan_id_unique").on(table.planId)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    /** Transitional nullable field until every existing deployment has backfilled version 1. */
    planVersionId: uuid("plan_version_id")
      .notNull()
      .references(() => planVersions.id),
    status: subscriptionStatus("status").notNull().default("trialing"),
    billingCycle: text("billing_cycle").notNull().default("monthly"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    trialFallbackPlanVersionId: uuid("trial_fallback_plan_version_id").references(
      () => planVersions.id,
    ),
    trialConvertedAt: timestamp("trial_converted_at", { withTimezone: true }),
    manualPaymentState: text("manual_payment_state").notNull().default("pending"),
  },
  (table) => [
    uniqueIndex("subscriptions_tenant_id_unique").on(table.tenantId),
    index("subscriptions_plan_version_id_idx").on(table.planVersionId),
  ],
);

/** Mutable marketing projection. Commercial and entitlement terms remain versioned separately. */
export const planPresentations = pgTable(
  "plan_presentations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    publicName: text("public_name").notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    featureList: jsonb("feature_list").notNull().default([]),
    badge: text("badge"),
    ctaLabel: text("cta_label").notNull().default("Choose plan"),
    landingVisible: boolean("landing_visible").notNull().default(false),
    featured: boolean("featured").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    updatedByUserId: text("updated_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plan_presentations_plan_id_unique").on(table.planId),
    index("plan_presentations_landing_idx").on(table.landingVisible, table.displayOrder),
  ],
);

/** Durable proof that a shop has consumed its one-time trial offer. */
export const subscriptionTrials = pgTable(
  "subscription_trials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id),
    planVersionId: uuid("plan_version_id")
      .notNull()
      .references(() => planVersions.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    fallbackPlanVersionId: uuid("fallback_plan_version_id")
      .notNull()
      .references(() => planVersions.id),
    status: text("status").notNull().default("active"),
    eligibilityKey: text("eligibility_key").notNull(),
    initiatedByUserId: text("initiated_by_user_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("subscription_trials_offer_claim_unique").on(table.planId, table.eligibilityKey),
    index("subscription_trials_expiry_idx").on(table.status, table.endsAt),
    check(
      "subscription_trials_status_valid",
      sql`${table.status} in ('active', 'converted', 'expired', 'canceled')`,
    ),
    check("subscription_trials_dates_valid", sql`${table.endsAt} > ${table.startedAt}`),
  ],
);

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  planVersionId: uuid("plan_version_id").references(() => planVersions.id),
  amount: numeric("amount").notNull(),
  currency: text("currency").notNull().default("ETB"),
  status: text("status").notNull().default("pending"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  provider: text("provider"),
  providerReference: text("provider_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Durable inbox for payment-provider facts that have already been verified.
 * Provider delivery and ECS state changes are deliberately separated so a
 * transient application failure can be retried without trusting the callback.
 */
export const billingProviderEvents = pgTable(
  "billing_provider_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("billing_provider_events_provider_key_unique").on(table.provider, table.eventKey),
    index("billing_provider_events_retry_idx").on(table.status, table.nextAttemptAt),
    check(
      "billing_provider_events_status_valid",
      sql`${table.status} in ('pending', 'processing', 'completed', 'failed')`,
    ),
    check("billing_provider_events_attempts_nonnegative", sql`${table.attempts} >= 0`),
  ],
);

/** Transactional hand-off from billing state changes to notification fan-out. */
export const billingOutboxEvents = pgTable(
  "billing_outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("billing_outbox_events_key_unique").on(table.eventKey),
    index("billing_outbox_events_retry_idx").on(table.status, table.nextAttemptAt),
    check(
      "billing_outbox_events_status_valid",
      sql`${table.status} in ('pending', 'processing', 'completed', 'failed')`,
    ),
    check("billing_outbox_events_attempts_nonnegative", sql`${table.attempts} >= 0`),
  ],
);

/**
 * @deprecated `plans.features` is the canonical entitlement store. This legacy
 * table remains mapped until a separately approved data-safe removal migration.
 */
export const planFeatures = pgTable("plan_features", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entitlementOverrides = pgTable("entitlement_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  reason: text("reason").notNull(),
  grantedByUserId: text("granted_by_user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const capabilityUsage = pgTable(
  "capability_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    key: text("key").notNull(),
    windowKey: text("window_key").notNull(),
    consumed: integer("consumed").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("capability_usage_scope_unique").on(table.tenantId, table.key, table.windowKey),
    check("capability_usage_consumed_nonnegative", sql`${table.consumed} >= 0`),
  ],
);

export const capabilityReservations = pgTable(
  "capability_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    key: text("key").notNull(),
    windowKey: text("window_key").notNull(),
    amount: integer("amount").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("capability_reservations_idempotency_unique").on(
      table.tenantId,
      table.key,
      table.windowKey,
      table.idempotencyKey,
    ),
    index("capability_reservations_active_scope_idx").on(
      table.tenantId,
      table.key,
      table.windowKey,
      table.status,
      table.expiresAt,
    ),
    check("capability_reservations_amount_positive", sql`${table.amount} > 0`),
    check(
      "capability_reservations_status_valid",
      sql`${table.status} in ('active', 'committed', 'released', 'expired')`,
    ),
  ],
);
