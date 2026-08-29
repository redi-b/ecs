import { createHash } from "node:crypto";

import {
  type PlanId,
  type PlanVersionId,
  type PublishedPlanVersion,
  publishPlanVersion,
} from "@ecs/billing";
import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  billingOutboxEvents,
  invoices,
  plans,
  planVersions,
  subscriptions,
} from "@ecs/db";
import { and, desc, eq, lte, sql } from "drizzle-orm";

import type {
  BillingInvoice,
  BillingInvoiceUpdateResult,
  BillingStatus,
  BillingStatusResult,
} from "../../types/index.js";
import {
  ENTITLEMENT_CATALOG,
  type PlanEntitlements,
  parsePlanEntitlements,
} from "../entitlements/catalog.js";
import { createEntitlementService } from "../entitlements/service.js";
import { DEFAULT_PLAN_CATALOG, DEFAULT_PLAN_IDS, DEFAULT_PLANS } from "./plan-catalog.js";

export { DEFAULT_PLAN_IDS } from "./plan-catalog.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
const allowedOperatorInvoiceStatuses = new Set(["paid", "cancelled", "void"]);

/** Platform-billing Chapa tx_ref prefix (commerce order refs must never use this). */
export const BILLING_CHAPA_TX_PREFIX = "ecs_bill_";

/** Issue renewal invoices this many days before period end. */
export const BILLING_RENEWAL_LEAD_DAYS = 7;

/**
 * Encoded in subscriptions.manual_payment_state when a free-plan downgrade
 * is scheduled for period end (no refunds — keep paid access until then).
 */
export const SCHEDULED_DOWNGRADE_PREFIX = "scheduled_downgrade:";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function encodeScheduledDowngrade(planId: string) {
  return `${SCHEDULED_DOWNGRADE_PREFIX}${planId}`;
}

export function parseScheduledDowngradePlanId(
  manualPaymentState: string | null | undefined,
): string | null {
  const value = manualPaymentState?.trim() ?? "";
  if (!value.startsWith(SCHEDULED_DOWNGRADE_PREFIX)) return null;
  const planId = value.slice(SCHEDULED_DOWNGRADE_PREFIX.length).trim();
  return planId || null;
}

export function isPlatformBillingTxRef(txRef: string) {
  return txRef.trim().toLowerCase().startsWith(BILLING_CHAPA_TX_PREFIX);
}

export function billingTxRefForInvoice(invoiceId: string) {
  // Unique every attempt — Chapa rejects reused tx_ref ("already been used").
  // Format: ecs_bill_{12 hex from invoice}_{8 random} (~29 chars, under Chapa limits).
  const compact = invoiceId.replaceAll("-", "").slice(0, 12);
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  return `${BILLING_CHAPA_TX_PREFIX}${compact}_${suffix}`;
}

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeInvoice(invoice: {
  amount: string;
  createdAt: Date;
  currency: string;
  dueAt: Date | null;
  id: string;
  paidAt: Date | null;
  provider: string | null;
  providerReference: string | null;
  status: string;
}): BillingInvoice {
  return {
    id: invoice.id,
    amount: String(invoice.amount),
    currency: invoice.currency,
    status: invoice.status,
    dueAt: serializeDate(invoice.dueAt),
    paidAt: serializeDate(invoice.paidAt),
    provider: invoice.provider?.trim() ? invoice.provider.trim() : null,
    providerReference: invoice.providerReference?.trim() ? invoice.providerReference.trim() : null,
    createdAt: invoice.createdAt.toISOString(),
  };
}

function selectInvoiceFields() {
  return {
    id: invoices.id,
    amount: invoices.amount,
    currency: invoices.currency,
    status: invoices.status,
    dueAt: invoices.dueAt,
    paidAt: invoices.paidAt,
    provider: invoices.provider,
    providerReference: invoices.providerReference,
    createdAt: invoices.createdAt,
  };
}

function addBillingMonths(from: Date, months: number) {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function planPriceNumber(price: string) {
  const value = Number(price);
  return Number.isFinite(value) ? value : NaN;
}

function isFreePlanPrice(price: string) {
  return planPriceNumber(price) === 0;
}

export function planBillingLifecycle(input: {
  currentPeriodEnd: Date | null;
  manualPaymentState: string;
  now: Date;
  status: string;
}) {
  const scheduledPlanId = parseScheduledDowngradePlanId(input.manualPaymentState);
  const periodEnded =
    input.currentPeriodEnd != null && input.currentPeriodEnd.getTime() <= input.now.getTime();
  if (scheduledPlanId) {
    return {
      createRenewalInvoice: false,
      markPastDue: false,
      scheduledPlanId,
      applyScheduledDowngrade: periodEnded,
    };
  }
  const renewalWindowStart = input.currentPeriodEnd
    ? input.currentPeriodEnd.getTime() - BILLING_RENEWAL_LEAD_DAYS * MS_PER_DAY
    : null;
  return {
    applyScheduledDowngrade: false,
    createRenewalInvoice: renewalWindowStart != null && input.now.getTime() >= renewalWindowStart,
    markPastDue: periodEnded && (input.status === "active" || input.status === "trialing"),
    scheduledPlanId: null,
  };
}

export function createBillingService(db: PlatformDb) {
  const entitlementService = createEntitlementService(db);
  const self = () => createBillingService(db);

  const latestPlanVersion = async (
    planId: string,
  ): Promise<PublishedPlanVersion<typeof ENTITLEMENT_CATALOG> | null> => {
    const [row] = await db
      .select({
        billingInterval: planVersions.billingInterval,
        currency: planVersions.currency,
        features: planVersions.features,
        fingerprint: planVersions.fingerprint,
        id: planVersions.id,
        planId: planVersions.planId,
        price: planVersions.price,
        publishedAt: planVersions.publishedAt,
        version: planVersions.version,
      })
      .from(planVersions)
      .where(eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.version))
      .limit(1);
    if (!row) return null;
    return {
      fingerprint: row.fingerprint,
      id: row.id as PlanVersionId,
      planId: row.planId as PlanId,
      publishedAt: row.publishedAt,
      terms: {
        capabilities: parsePlanEntitlements(row.features),
        currency: row.currency,
        interval:
          row.billingInterval === "day" ||
          row.billingInterval === "week" ||
          row.billingInterval === "year"
            ? row.billingInterval
            : "month",
        priceMinor: Math.round(Number(row.price) * 100),
      },
      version: row.version,
    };
  };

  const ensurePublishedPlanVersion = async (plan: (typeof DEFAULT_PLANS)[number]) => {
    const latest = await latestPlanVersion(plan.id);
    const publication = await publishPlanVersion({
      catalog: ENTITLEMENT_CATALOG,
      fingerprint: {
        digest: async (canonicalTerms) => createHash("sha256").update(canonicalTerms).digest("hex"),
      },
      identifiers: { create: () => crypto.randomUUID() as PlanVersionId },
      latest,
      now: new Date(),
      planId: plan.id as PlanId,
      terms: {
        capabilities: plan.features as PlanEntitlements,
        currency: "ETB",
        interval: "month",
        priceMinor: Math.round(Number(plan.price) * 100),
      },
    });
    if (publication.action === "published") {
      await db
        .insert(planVersions)
        .values({
          id: publication.version.id,
          planId: plan.id,
          version: publication.version.version,
          fingerprint: publication.version.fingerprint,
          name: plan.name,
          price: plan.price,
          currency: publication.version.terms.currency,
          billingInterval: publication.version.terms.interval,
          limits: plan.limits,
          features: publication.version.terms.capabilities,
          publishedAt: publication.version.publishedAt,
        })
        .onConflictDoNothing();
    }
    return (await latestPlanVersion(plan.id)) ?? publication.version;
  };

  return {
    ensureDefaultPlans: async () => {
      for (const plan of DEFAULT_PLANS) {
        await db
          .insert(plans)
          .values(plan)
          .onConflictDoUpdate({
            target: plans.id,
            set: {
              // Transitional latest-version projection for legacy readers.
              features: plan.features,
              limits: plan.limits,
              name: plan.name,
              price: plan.price,
              status: plan.status,
            },
          });
        await ensurePublishedPlanVersion(plan);
      }
    },

    /**
     * Free forever Starter when a shop is provisioned (idempotent).
     * No trial expiry, no payment invoices.
     */
    ensureFreeSubscription: async (input: { tenantId: string }) => {
      await self().ensureDefaultPlans();

      const [existing] = await db
        .select({
          id: subscriptions.id,
          planId: subscriptions.planId,
          planVersionId: subscriptions.planVersionId,
          status: subscriptions.status,
        })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);

      if (existing) {
        const pinnedVersion = existing.planVersionId
          ? null
          : await latestPlanVersion(existing.planId);
        // One-time soft migrate: only the free Starter plan. Paid-plan trials
        // (future Growth trialing) are left alone so we can still use trialing later.
        if (existing.planId === DEFAULT_PLAN_IDS.starter && existing.status === "trialing") {
          await db
            .update(subscriptions)
            .set({
              status: "active",
              currentPeriodEnd: null,
              manualPaymentState: "none",
              ...(pinnedVersion ? { planVersionId: pinnedVersion.id } : {}),
            })
            .where(eq(subscriptions.id, existing.id));
        } else if (pinnedVersion) {
          await db
            .update(subscriptions)
            .set({ planVersionId: pinnedVersion.id })
            .where(eq(subscriptions.id, existing.id));
        }
        return { created: false as const, subscriptionId: existing.id };
      }

      const now = new Date();
      const starterVersion = await ensurePublishedPlanVersion(DEFAULT_PLAN_CATALOG.starter);
      const [subscription] = await db
        .insert(subscriptions)
        .values({
          tenantId: input.tenantId,
          planId: DEFAULT_PLAN_CATALOG.starter.id,
          planVersionId: starterVersion.id,
          status: "active",
          billingCycle: "monthly",
          currentPeriodStart: now,
          currentPeriodEnd: null,
          manualPaymentState: "none",
        })
        .onConflictDoNothing({ target: subscriptions.tenantId })
        .returning({ id: subscriptions.id });

      if (subscription) {
        return { created: true as const, subscriptionId: subscription.id };
      }

      const [concurrent] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);
      return { created: false as const, subscriptionId: concurrent?.id ?? null };
    },

    /** @deprecated Prefer ensureFreeSubscription — kept for call sites. */
    ensureTrialSubscription: async (input: { tenantId: string }) => {
      return self().ensureFreeSubscription(input);
    },

    listPlans: async () => {
      await self().ensureDefaultPlans();
      const rows = await db
        .select({
          id: plans.id,
          name: plans.name,
          price: plans.price,
          limits: plans.limits,
          features: plans.features,
          status: plans.status,
        })
        .from(plans)
        .where(eq(plans.status, "active"))
        .orderBy(plans.price);

      return {
        ok: true as const,
        plans: rows.map((plan) => ({
          id: plan.id,
          name: plan.name,
          price: plan.price,
          limits: plan.limits,
          features: plan.features,
          status: plan.status,
          isFree: isFreePlanPrice(plan.price),
        })),
      };
    },

    /**
     * Per-tenant maintenance: apply scheduled free downgrades, renewal invoices,
     * past_due when expired. Free plans are never touched. Safe on every billing read.
     */
    syncTenantBillingLifecycle: async (input: { tenantId: string }) => {
      const result = await db.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`billing-lifecycle:${input.tenantId}`}, 0))`,
        );

        const [row] = await transaction
          .select({
            subscriptionId: subscriptions.id,
            planVersionId: subscriptions.planVersionId,
            status: subscriptions.status,
            planId: plans.id,
            planName: sql<string>`coalesce(${planVersions.name}, ${plans.name})`,
            planPrice: sql<string>`coalesce(${planVersions.price}, ${plans.price})`,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            manualPaymentState: subscriptions.manualPaymentState,
          })
          .from(subscriptions)
          .innerJoin(plans, eq(plans.id, subscriptions.planId))
          .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
          .where(eq(subscriptions.tenantId, input.tenantId))
          .limit(1);

        if (!row || isFreePlanPrice(row.planPrice)) {
          return {
            renewed: false,
            pastDue: false,
            scheduled: null as null | { planId: string; subscriptionId: string },
          };
        }

        const lifecycle = planBillingLifecycle({
          currentPeriodEnd: row.currentPeriodEnd,
          manualPaymentState: row.manualPaymentState,
          now: new Date(),
          status: row.status,
        });
        if (lifecycle.scheduledPlanId) {
          return {
            renewed: false,
            pastDue: false,
            scheduled: lifecycle.applyScheduledDowngrade
              ? { planId: lifecycle.scheduledPlanId, subscriptionId: row.subscriptionId }
              : null,
          };
        }

        const payload = {
          subscriptionId: row.subscriptionId,
          planName: row.planName,
          amount: String(row.planPrice),
          currencyCode: "ETB",
        };
        let pastDue = false;
        let renewed = false;

        if (lifecycle.markPastDue) {
          const [changed] = await transaction
            .update(subscriptions)
            .set({ status: "past_due" })
            .where(
              and(eq(subscriptions.id, row.subscriptionId), eq(subscriptions.status, row.status)),
            )
            .returning({ id: subscriptions.id });
          if (changed) {
            pastDue = true;
            const period = row.currentPeriodEnd?.toISOString() ?? "unknown-period";
            await transaction
              .insert(billingOutboxEvents)
              .values({
                eventKey: `billing.past_due:${row.subscriptionId}:${period}`,
                eventType: "billing.past_due",
                tenantId: input.tenantId,
                payload,
              })
              .onConflictDoNothing({ target: billingOutboxEvents.eventKey });
          }
        }

        if (lifecycle.createRenewalInvoice) {
          const [existing] = await transaction
            .select({ id: invoices.id })
            .from(invoices)
            .where(
              and(
                eq(invoices.tenantId, input.tenantId),
                eq(invoices.status, "pending"),
                eq(invoices.amount, row.planPrice),
                eq(invoices.currency, "ETB"),
              ),
            )
            .limit(1);

          if (!existing) {
            const dueAt = new Date();
            dueAt.setUTCDate(dueAt.getUTCDate() + BILLING_RENEWAL_LEAD_DAYS);
            const [created] = await transaction
              .insert(invoices)
              .values({
                tenantId: input.tenantId,
                subscriptionId: row.subscriptionId,
                planVersionId: row.planVersionId,
                amount: row.planPrice,
                currency: "ETB",
                status: "pending",
                dueAt,
                provider: `plan:${row.planId}`,
              })
              .returning({ id: invoices.id });
            if (created) {
              renewed = true;
              await transaction
                .insert(billingOutboxEvents)
                .values({
                  eventKey: `billing.invoice_ready:${created.id}`,
                  eventType: "billing.invoice_ready",
                  tenantId: input.tenantId,
                  payload: { ...payload, invoiceId: created.id },
                })
                .onConflictDoNothing({ target: billingOutboxEvents.eventKey });
            }
          }
        }

        return {
          renewed,
          pastDue,
          scheduled: null as null | { planId: string; subscriptionId: string },
        };
      });

      if (result.scheduled) {
        const applied = await self().applyScheduledDowngrade({
          tenantId: input.tenantId,
          subscriptionId: result.scheduled.subscriptionId,
          planId: result.scheduled.planId,
        });
        return { renewed: false, pastDue: false, downgraded: applied };
      }
      return { renewed: result.renewed, pastDue: result.pastDue, downgraded: false };
    },

    /** Apply a free (or other) plan change at period end; void open pay invoices. */
    applyScheduledDowngrade: async (input: {
      tenantId: string;
      subscriptionId: string;
      planId: string;
    }) => {
      const [plan] = await db
        .select({ id: plans.id, price: plans.price, status: plans.status })
        .from(plans)
        .where(and(eq(plans.id, input.planId), eq(plans.status, "active")))
        .limit(1);

      if (!plan) return false;
      const version = await latestPlanVersion(plan.id);
      if (!version) return false;

      const now = new Date();
      await db
        .update(subscriptions)
        .set({
          planId: plan.id,
          planVersionId: version.id,
          status: "active",
          currentPeriodStart: now,
          // Free forever has no period end pressure.
          currentPeriodEnd: isFreePlanPrice(plan.price) ? null : addBillingMonths(now, 1),
          manualPaymentState: isFreePlanPrice(plan.price) ? "none" : "paid",
        })
        .where(
          and(
            eq(subscriptions.id, input.subscriptionId),
            eq(subscriptions.tenantId, input.tenantId),
          ),
        );

      await db
        .update(invoices)
        .set({ status: "void" })
        .where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.status, "pending")));

      return true;
    },

    /**
     * Schedule free-plan switch at period end, or apply immediately if already expired.
     * No refunds: paid time is kept until currentPeriodEnd.
     */
    schedulePlanDowngrade: async (input: {
      planId: string;
      tenantId: string;
    }): Promise<
      | {
          ok: true;
          applied: boolean;
          scheduled: boolean;
          effectiveAt: string | null;
          billing: BillingStatus;
        }
      | {
          ok: false;
          error:
            | "billing_not_found"
            | "billing_plan_not_found"
            | "billing_plan_not_free"
            | "billing_already_on_plan"
            | "billing_not_on_paid_plan";
          status: 400 | 404;
        }
    > => {
      await self().ensureFreeSubscription(input);

      const [plan] = await db
        .select({
          id: plans.id,
          name: plans.name,
          price: plans.price,
          status: plans.status,
        })
        .from(plans)
        .where(and(eq(plans.id, input.planId), eq(plans.status, "active")))
        .limit(1);

      if (!plan) {
        return { ok: false, error: "billing_plan_not_found", status: 404 };
      }

      if (!isFreePlanPrice(plan.price)) {
        return { ok: false, error: "billing_plan_not_free", status: 400 };
      }

      const [subscription] = await db
        .select({
          id: subscriptions.id,
          planId: subscriptions.planId,
          status: subscriptions.status,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          manualPaymentState: subscriptions.manualPaymentState,
          planPrice: sql<string>`coalesce(${planVersions.price}, ${plans.price})`,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);

      if (!subscription) {
        return { ok: false, error: "billing_not_found", status: 404 };
      }

      if (subscription.planId === plan.id) {
        // Already free; clear any stale schedule.
        if (parseScheduledDowngradePlanId(subscription.manualPaymentState)) {
          await db
            .update(subscriptions)
            .set({ manualPaymentState: "none" })
            .where(eq(subscriptions.id, subscription.id));
        }
        return { ok: false, error: "billing_already_on_plan", status: 400 };
      }

      if (isFreePlanPrice(subscription.planPrice)) {
        return { ok: false, error: "billing_not_on_paid_plan", status: 400 };
      }

      const now = new Date();
      const periodActive =
        subscription.currentPeriodEnd != null &&
        subscription.currentPeriodEnd.getTime() > now.getTime() &&
        subscription.status !== "past_due";

      if (!periodActive) {
        // Past due / expired / no period: switch immediately (nothing left to refund).
        await self().applyScheduledDowngrade({
          tenantId: input.tenantId,
          subscriptionId: subscription.id,
          planId: plan.id,
        });
        const status = await self().getBillingStatus({ tenantId: input.tenantId });
        if (!status.ok) {
          return { ok: false, error: "billing_not_found", status: 404 };
        }
        return {
          ok: true,
          applied: true,
          scheduled: false,
          effectiveAt: null,
          billing: status.billing,
        };
      }

      // Keep Growth until period end; cancel open pay/renewal invoices.
      await db
        .update(subscriptions)
        .set({ manualPaymentState: encodeScheduledDowngrade(plan.id) })
        .where(eq(subscriptions.id, subscription.id));

      await db
        .update(invoices)
        .set({ status: "void" })
        .where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.status, "pending")));

      const status = await self().getBillingStatus({ tenantId: input.tenantId });
      if (!status.ok) {
        return { ok: false, error: "billing_not_found", status: 404 };
      }

      return {
        ok: true,
        applied: false,
        scheduled: true,
        effectiveAt: serializeDate(subscription.currentPeriodEnd),
        billing: status.billing,
      };
    },

    /** Cancel a scheduled free switch and keep the current paid plan. */
    cancelScheduledPlanDowngrade: async (input: {
      tenantId: string;
    }): Promise<
      | { ok: true; cancelled: boolean; billing: BillingStatus }
      | {
          ok: false;
          error: "billing_not_found" | "billing_no_scheduled_downgrade";
          status: 400 | 404;
        }
    > => {
      const [subscription] = await db
        .select({
          id: subscriptions.id,
          manualPaymentState: subscriptions.manualPaymentState,
          planPrice: sql<string>`coalesce(${planVersions.price}, ${plans.price})`,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);

      if (!subscription) {
        return { ok: false, error: "billing_not_found", status: 404 };
      }

      if (!parseScheduledDowngradePlanId(subscription.manualPaymentState)) {
        return { ok: false, error: "billing_no_scheduled_downgrade", status: 400 };
      }

      await db
        .update(subscriptions)
        .set({
          manualPaymentState: isFreePlanPrice(subscription.planPrice) ? "none" : "paid",
        })
        .where(eq(subscriptions.id, subscription.id));

      const status = await self().getBillingStatus({ tenantId: input.tenantId });
      if (!status.ok) {
        return { ok: false, error: "billing_not_found", status: 404 };
      }

      return { ok: true, cancelled: true, billing: status.billing };
    },

    /**
     * Ensure a pending invoice exists for a paid plan (upgrade or renewal).
     */
    ensurePendingPlanInvoice: async (input: {
      tenantId: string;
      subscriptionId: string;
      planId: string;
      planVersionId: string | null;
      planPrice: string;
    }): Promise<{ created: boolean; invoiceId: string | null }> => {
      if (isFreePlanPrice(input.planPrice)) {
        return { created: false, invoiceId: null };
      }

      const [existing] = await db
        .select({ ...selectInvoiceFields(), planVersionId: invoices.planVersionId })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, input.tenantId),
            eq(invoices.status, "pending"),
            eq(invoices.amount, input.planPrice),
            eq(invoices.currency, "ETB"),
          ),
        )
        .orderBy(desc(invoices.createdAt))
        .limit(1);

      if (existing) {
        if (
          !existing.provider?.startsWith("plan:") ||
          (!existing.planVersionId && input.planVersionId)
        ) {
          await db
            .update(invoices)
            .set({
              provider: `plan:${input.planId}`,
              ...(input.planVersionId ? { planVersionId: input.planVersionId } : {}),
            })
            .where(eq(invoices.id, existing.id));
        }
        return { created: false, invoiceId: existing.id };
      }

      const now = new Date();
      const dueAt = new Date(now);
      dueAt.setUTCDate(dueAt.getUTCDate() + BILLING_RENEWAL_LEAD_DAYS);

      const [created] = await db
        .insert(invoices)
        .values({
          tenantId: input.tenantId,
          subscriptionId: input.subscriptionId,
          planVersionId: input.planVersionId,
          amount: input.planPrice,
          currency: "ETB",
          status: "pending",
          dueAt,
          paidAt: null,
          provider: `plan:${input.planId}`,
          providerReference: null,
        })
        .returning({ id: invoices.id });

      return { created: Boolean(created), invoiceId: created?.id ?? null };
    },

    /**
     * Sweep all paid subscriptions (worker entrypoint).
     */
    runBillingLifecycle: async () => {
      const rows = await db
        .select({
          tenantId: subscriptions.tenantId,
          planPrice: sql<string>`coalesce(${planVersions.price}, ${plans.price})`,
          planName: sql<string>`coalesce(${planVersions.name}, ${plans.name})`,
          subscriptionId: subscriptions.id,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId));

      let scanned = 0;
      let renewed = 0;
      let pastDue = 0;

      for (const row of rows) {
        if (isFreePlanPrice(row.planPrice)) continue;
        scanned += 1;
        const result = await self().syncTenantBillingLifecycle({ tenantId: row.tenantId });
        if (result.renewed) {
          renewed += 1;
        }
        if (result.pastDue) {
          pastDue += 1;
        }
      }

      const now = new Date();
      const reminderCutoff = new Date(now.getTime() + 3 * MS_PER_DAY);
      const reminderInvoices = await db
        .select({
          amount: invoices.amount,
          currency: invoices.currency,
          dueAt: invoices.dueAt,
          invoiceId: invoices.id,
          planName: sql<string>`coalesce(${planVersions.name}, ${plans.name})`,
          subscriptionId: subscriptions.id,
          tenantId: invoices.tenantId,
        })
        .from(invoices)
        .innerJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .leftJoin(planVersions, eq(planVersions.id, invoices.planVersionId))
        .where(
          and(
            eq(invoices.status, "pending"),
            sql`${invoices.dueAt} is not null`,
            lte(invoices.dueAt, reminderCutoff),
            sql`${invoices.dueAt} > ${now}`,
          ),
        );

      let reminders = 0;
      for (const invoice of reminderInvoices) {
        if (!invoice.dueAt) continue;
        const daysRemaining = Math.ceil((invoice.dueAt.getTime() - now.getTime()) / MS_PER_DAY);
        if (daysRemaining !== 3 && daysRemaining !== 1) continue;
        const [created] = await db
          .insert(billingOutboxEvents)
          .values({
            eventKey: `billing.payment_reminder:${invoice.invoiceId}:${daysRemaining}`,
            eventType: "billing.invoice_ready",
            tenantId: invoice.tenantId,
            payload: {
              amount: String(invoice.amount),
              currencyCode: invoice.currency,
              daysRemaining,
              dueAt: invoice.dueAt.toISOString(),
              invoiceId: invoice.invoiceId,
              planName: invoice.planName,
              subscriptionId: invoice.subscriptionId,
            },
          })
          .onConflictDoNothing({ target: billingOutboxEvents.eventKey })
          .returning({ id: billingOutboxEvents.id });
        if (created) reminders += 1;
      }

      return { scanned, renewed, pastDue, reminders };
    },

    getBillingStatus: async (input: { tenantId: string }): Promise<BillingStatusResult> => {
      await self().ensureFreeSubscription(input);
      try {
        await self().syncTenantBillingLifecycle(input);
      } catch {
        // Lifecycle is best-effort; never block the billing page on it.
      }

      const [subscription] = await db
        .select({
          subscriptionId: subscriptions.id,
          planVersionId: subscriptions.planVersionId,
          status: subscriptions.status,
          billingCycle: subscriptions.billingCycle,
          currentPeriodStart: subscriptions.currentPeriodStart,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          manualPaymentState: subscriptions.manualPaymentState,
          planId: plans.id,
          planName: sql<string>`coalesce(${planVersions.name}, ${plans.name})`,
          planPrice: sql<string>`coalesce(${planVersions.price}, ${plans.price})`,
          planLimits: sql<unknown>`coalesce(${planVersions.limits}, ${plans.limits})`,
          planFeatures: sql<unknown>`coalesce(${planVersions.features}, ${plans.features})`,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .where(eq(subscriptions.tenantId, input.tenantId))
        // Prefer non-null period ends first, but free forever has null end — still returns a row.
        .orderBy(desc(subscriptions.currentPeriodEnd))
        .limit(1);

      if (!subscription) {
        // Last resort: free sub may have failed insert race; try once more.
        await self().ensureFreeSubscription(input);
        const [retry] = await db
          .select({
            subscriptionId: subscriptions.id,
            planVersionId: subscriptions.planVersionId,
            status: subscriptions.status,
            billingCycle: subscriptions.billingCycle,
            currentPeriodStart: subscriptions.currentPeriodStart,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            manualPaymentState: subscriptions.manualPaymentState,
            planId: plans.id,
            planName: sql<string>`coalesce(${planVersions.name}, ${plans.name})`,
            planPrice: sql<string>`coalesce(${planVersions.price}, ${plans.price})`,
            planLimits: sql<unknown>`coalesce(${planVersions.limits}, ${plans.limits})`,
            planFeatures: sql<unknown>`coalesce(${planVersions.features}, ${plans.features})`,
          })
          .from(subscriptions)
          .innerJoin(plans, eq(plans.id, subscriptions.planId))
          .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
          .where(eq(subscriptions.tenantId, input.tenantId))
          .limit(1);

        if (!retry) {
          return {
            ok: false,
            error: "billing_not_found",
          };
        }

        return self().buildBillingStatusResult(retry, input.tenantId);
      }

      return self().buildBillingStatusResult(subscription, input.tenantId);
    },

    buildBillingStatusResult: async (
      subscription: {
        subscriptionId: string;
        planVersionId: string | null;
        status: string;
        billingCycle: string;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        manualPaymentState: string;
        planId: string;
        planName: string;
        planPrice: string;
        planLimits: unknown;
        planFeatures: unknown;
      },
      tenantId: string,
    ): Promise<BillingStatusResult> => {
      const invoiceRows = await db
        .select(selectInvoiceFields())
        .from(invoices)
        .where(eq(invoices.tenantId, tenantId))
        .orderBy(desc(invoices.createdAt))
        .limit(20);

      const planList = await self().listPlans();
      const catalog = planList.plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        isFree: plan.isFree,
        isCurrent: plan.id === subscription.planId,
        limits: plan.limits,
        features: plan.features,
      }));
      const availablePaidPlans = planList.plans.filter(
        (plan) => !plan.isFree && plan.id !== subscription.planId,
      );

      const scheduledPlanId = parseScheduledDowngradePlanId(subscription.manualPaymentState);
      const scheduledPlan = scheduledPlanId
        ? (planList.plans.find((plan) => plan.id === scheduledPlanId) ?? null)
        : null;
      // Surface a clean state to clients while schedule is encoded in DB.
      const clientPaymentState = scheduledPlanId
        ? "scheduled_downgrade"
        : subscription.manualPaymentState || "none";
      const entitlements = await entitlementService.evaluateAll({ tenantId });

      return {
        ok: true,
        billing: {
          entitlements,
          subscription: {
            id: subscription.subscriptionId,
            planVersionId: subscription.planVersionId,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            manualPaymentState: clientPaymentState,
            currentPeriodStart: serializeDate(subscription.currentPeriodStart),
            currentPeriodEnd: serializeDate(subscription.currentPeriodEnd),
            scheduledPlanId: scheduledPlan?.id ?? null,
            scheduledPlanName: scheduledPlan?.name ?? null,
            /** When a free switch is scheduled, it takes effect at period end. */
            scheduledEffectiveAt:
              scheduledPlan && subscription.currentPeriodEnd
                ? serializeDate(subscription.currentPeriodEnd)
                : null,
          },
          plan: {
            id: subscription.planId,
            name: subscription.planName,
            price: String(subscription.planPrice),
            limits: subscription.planLimits ?? {},
            features: subscription.planFeatures ?? {},
            isFree: isFreePlanPrice(String(subscription.planPrice)),
          },
          invoices: invoiceRows.map((invoice) => serializeInvoice(invoice)),
          availablePaidPlans: availablePaidPlans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            price: String(plan.price),
            limits: plan.limits ?? {},
            features: plan.features ?? {},
          })),
          catalog,
        },
      };
    },

    /**
     * Self-serve: create (or reuse) a pending invoice to move onto a paid plan.
     * Free plans never get payment invoices. Plan switches only after Chapa pay.
     */
    createPlanUpgradeInvoice: async (input: {
      planId: string;
      tenantId: string;
    }): Promise<
      | { ok: true; invoice: BillingInvoice; reused: boolean }
      | {
          ok: false;
          error:
            | "billing_not_found"
            | "billing_plan_not_found"
            | "billing_plan_is_free"
            | "billing_already_on_plan";
          status: 400 | 404;
        }
    > => {
      await self().ensureFreeSubscription(input);

      const [plan] = await db
        .select({
          id: plans.id,
          name: plans.name,
          price: plans.price,
          status: plans.status,
        })
        .from(plans)
        .where(and(eq(plans.id, input.planId), eq(plans.status, "active")))
        .limit(1);

      if (!plan) {
        return { ok: false, error: "billing_plan_not_found", status: 404 };
      }

      if (isFreePlanPrice(plan.price)) {
        return { ok: false, error: "billing_plan_is_free", status: 400 };
      }

      const [subscription] = await db
        .select({
          id: subscriptions.id,
          planId: subscriptions.planId,
          status: subscriptions.status,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          manualPaymentState: subscriptions.manualPaymentState,
        })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);

      if (!subscription) {
        return { ok: false, error: "billing_not_found", status: 404 };
      }

      // Paying / renewing cancels any free-switch schedule.
      if (parseScheduledDowngradePlanId(subscription.manualPaymentState)) {
        await db
          .update(subscriptions)
          .set({ manualPaymentState: "paid" })
          .where(eq(subscriptions.id, subscription.id));
      }

      const now = new Date();
      // Allow renewal invoices inside the lead window or after period end.
      const renewalCutoff = now.getTime() + BILLING_RENEWAL_LEAD_DAYS * MS_PER_DAY;
      const stillCovered =
        subscription.planId === plan.id &&
        subscription.status === "active" &&
        subscription.currentPeriodEnd != null &&
        subscription.currentPeriodEnd.getTime() > renewalCutoff;

      if (stillCovered) {
        return { ok: false, error: "billing_already_on_plan", status: 400 };
      }

      const ensured = await self().ensurePendingPlanInvoice({
        tenantId: input.tenantId,
        subscriptionId: subscription.id,
        planId: plan.id,
        planVersionId: (await latestPlanVersion(plan.id))?.id ?? null,
        planPrice: plan.price,
      });

      if (!ensured.invoiceId) {
        return { ok: false, error: "billing_not_found", status: 404 };
      }

      const [row] = await db
        .select(selectInvoiceFields())
        .from(invoices)
        .where(eq(invoices.id, ensured.invoiceId))
        .limit(1);

      if (!row) {
        return { ok: false, error: "billing_not_found", status: 404 };
      }

      return {
        ok: true,
        invoice: serializeInvoice(row),
        reused: !ensured.created,
      };
    },

    /**
     * Bind a fresh Chapa tx_ref on a pending paid invoice (new ref every attempt).
     * Caller should first try verifying any prior tx_ref via confirm/complete.
     */
    prepareInvoiceForChapaPayment: async (input: {
      invoiceId: string;
      tenantId: string;
    }): Promise<
      | {
          ok: true;
          invoice: BillingInvoice;
          amount: string;
          currency: string;
          txRef: string;
          planId: string | null;
          previousTxRef: string | null;
        }
      | {
          ok: false;
          error:
            | "billing_invoice_not_found"
            | "billing_invoice_not_payable"
            | "billing_invoice_is_free";
          status: 400 | 404;
        }
    > => {
      const [invoice] = await db
        .select({
          ...selectInvoiceFields(),
          planVersionId: invoices.planVersionId,
          subscriptionId: invoices.subscriptionId,
        })
        .from(invoices)
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId)))
        .limit(1);

      if (!invoice) {
        return { ok: false, error: "billing_invoice_not_found", status: 404 };
      }

      if (invoice.status !== "pending") {
        return { ok: false, error: "billing_invoice_not_payable", status: 400 };
      }

      if (isFreePlanPrice(invoice.amount)) {
        return { ok: false, error: "billing_invoice_is_free", status: 400 };
      }

      const previousTxRef =
        invoice.providerReference && isPlatformBillingTxRef(invoice.providerReference)
          ? invoice.providerReference
          : null;

      // Always mint a new tx_ref so retries work after a prior Chapa initialize.
      const txRef = billingTxRefForInvoice(invoice.id);
      const planIdFromProvider = invoice.provider?.startsWith("plan:")
        ? invoice.provider.slice("plan:".length)
        : null;

      await db
        .update(invoices)
        .set({
          // Keep plan:{id} so completeChapaInvoicePayment knows the target plan.
          provider: planIdFromProvider ? `plan:${planIdFromProvider}` : invoice.provider,
          providerReference: txRef,
        })
        .where(eq(invoices.id, invoice.id));

      const [updated] = await db
        .select(selectInvoiceFields())
        .from(invoices)
        .where(eq(invoices.id, invoice.id))
        .limit(1);

      return {
        ok: true,
        invoice: serializeInvoice(updated ?? invoice),
        amount: invoice.amount,
        currency: invoice.currency,
        txRef,
        planId: planIdFromProvider,
        previousTxRef,
      };
    },

    /**
     * Find pending platform-billing invoices for a tenant (with Chapa tx refs).
     * Used to re-verify after return_url when webhook/callback did not run (local dev).
     */
    listPendingChapaInvoiceTxRefs: async (input: { tenantId: string }) => {
      const rows = await db
        .select({
          id: invoices.id,
          tenantId: invoices.tenantId,
          providerReference: invoices.providerReference,
          status: invoices.status,
        })
        .from(invoices)
        .where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.status, "pending")));

      return rows
        .filter((row) => row.providerReference && isPlatformBillingTxRef(row.providerReference))
        .map((row) => ({
          invoiceId: row.id,
          tenantId: row.tenantId,
          txRef: row.providerReference as string,
        }));
    },

    /**
     * Global sweep of pending ecs_bill_* invoices (worker reconcile job).
     * Newest first; limited so one run cannot hammer Chapa.
     */
    listAllPendingChapaInvoiceTxRefs: async (input?: { limit?: number }) => {
      const limit = Math.min(Math.max(input?.limit ?? 100, 1), 500);
      const rows = await db
        .select({
          id: invoices.id,
          tenantId: invoices.tenantId,
          providerReference: invoices.providerReference,
        })
        .from(invoices)
        .where(eq(invoices.status, "pending"))
        .orderBy(desc(invoices.createdAt))
        .limit(limit);

      return rows
        .filter((row) => row.providerReference && isPlatformBillingTxRef(row.providerReference))
        .map((row) => ({
          invoiceId: row.id,
          tenantId: row.tenantId,
          txRef: row.providerReference as string,
        }));
    },

    /**
     * After Chapa verifies success for an ecs_bill_ tx_ref: mark invoice paid and activate plan period.
     */
    completeChapaInvoicePayment: async (input: {
      providerReference?: string | null;
      tenantId: string;
      txRef: string;
    }): Promise<{ ok: true; applied: boolean } | { ok: false; error: string }> => {
      if (!isPlatformBillingTxRef(input.txRef)) {
        return { ok: false, error: "not_platform_billing_tx" };
      }

      const [invoice] = await db
        .select({
          ...selectInvoiceFields(),
          planVersionId: invoices.planVersionId,
          subscriptionId: invoices.subscriptionId,
        })
        .from(invoices)
        .where(
          and(eq(invoices.tenantId, input.tenantId), eq(invoices.providerReference, input.txRef)),
        )
        .limit(1);

      if (!invoice) {
        return { ok: false, error: "billing_invoice_not_found" };
      }

      if (invoice.status === "paid") {
        return { ok: true, applied: false };
      }

      if (invoice.status !== "pending") {
        return { ok: false, error: "billing_invoice_not_payable" };
      }

      const planIdFromProvider = invoice.provider?.startsWith("plan:")
        ? invoice.provider.slice("plan:".length)
        : null;

      await db.transaction(async (transaction) => {
        await transaction
          .update(invoices)
          .set({
            status: "paid",
            paidAt: new Date(),
            provider: "chapa",
            providerReference: input.providerReference?.trim() || input.txRef,
          })
          .where(eq(invoices.id, invoice.id));

        if (!invoice.subscriptionId) {
          return;
        }

        const [sub] = await transaction
          .select({
            billingCycle: subscriptions.billingCycle,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            planId: subscriptions.planId,
            planVersionId: subscriptions.planVersionId,
          })
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.id, invoice.subscriptionId),
              eq(subscriptions.tenantId, input.tenantId),
            ),
          )
          .limit(1);

        const now = new Date();
        const base =
          sub?.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
        const months = sub?.billingCycle === "yearly" ? 12 : 1;
        const nextEnd = addBillingMonths(base, months);
        const nextPlanId = planIdFromProvider ?? sub?.planId ?? DEFAULT_PLAN_IDS.growth;
        const [nextPlanVersion] = invoice.planVersionId
          ? [{ id: invoice.planVersionId }]
          : await transaction
              .select({ id: planVersions.id })
              .from(planVersions)
              .where(eq(planVersions.planId, nextPlanId))
              .orderBy(desc(planVersions.version))
              .limit(1);
        const nextPlanVersionId = nextPlanVersion?.id ?? sub?.planVersionId;
        if (!nextPlanVersionId) {
          throw new Error("billing_plan_version_not_found");
        }

        await transaction
          .update(subscriptions)
          .set({
            planId: nextPlanId,
            planVersionId: nextPlanVersionId,
            currentPeriodEnd: nextEnd,
            currentPeriodStart: now,
            manualPaymentState: "paid",
            status: "active",
          })
          .where(
            and(
              eq(subscriptions.id, invoice.subscriptionId),
              eq(subscriptions.tenantId, input.tenantId),
            ),
          );
      });

      return { ok: true, applied: true };
    },

    updateBillingInvoiceStatus: async (input: {
      invoiceId: string;
      operatorUserId: string;
      platformPrincipalId: string;
      provider?: string | null | undefined;
      providerReference?: string | null | undefined;
      reason: string;
      status: string;
      tenantId: string;
    }): Promise<BillingInvoiceUpdateResult> => {
      const status = input.status.trim().toLowerCase();

      if (
        !allowedOperatorInvoiceStatuses.has(status) ||
        input.reason.trim().length < 10 ||
        (status === "paid" && (!input.provider?.trim() || !input.providerReference?.trim()))
      ) {
        return {
          ok: false,
          error: "billing_invoice_status_invalid",
          status: 400,
        };
      }

      const invoice = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(invoices)
          .set({
            paidAt: status === "paid" ? new Date() : null,
            provider: input.provider ?? null,
            providerReference: input.providerReference ?? null,
            status,
          })
          .where(
            and(
              eq(invoices.id, input.invoiceId),
              eq(invoices.tenantId, input.tenantId),
              eq(invoices.status, "pending"),
            ),
          )
          .returning({
            ...selectInvoiceFields(),
            subscriptionId: invoices.subscriptionId,
          });

        if (!row) {
          return null;
        }

        if (status === "paid" && row.subscriptionId) {
          const [sub] = await transaction
            .select({
              billingCycle: subscriptions.billingCycle,
              currentPeriodEnd: subscriptions.currentPeriodEnd,
            })
            .from(subscriptions)
            .where(
              and(
                eq(subscriptions.id, row.subscriptionId),
                eq(subscriptions.tenantId, input.tenantId),
              ),
            )
            .limit(1);

          const now = new Date();
          const base =
            sub?.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
          const months = sub?.billingCycle === "yearly" ? 12 : 1;
          const nextEnd = addBillingMonths(base, months);

          await transaction
            .update(subscriptions)
            .set({
              currentPeriodEnd: nextEnd,
              currentPeriodStart: now,
              manualPaymentState: "paid",
              status: "active",
            })
            .where(
              and(
                eq(subscriptions.id, row.subscriptionId),
                eq(subscriptions.tenantId, input.tenantId),
              ),
            );
        }

        await transaction.insert(auditLogs).values({
          actorUserId: input.operatorUserId,
          platformPrincipalId: input.platformPrincipalId,
          tenantId: input.tenantId,
          action: "billing.invoice_status_changed",
          targetType: "invoice",
          targetId: row.id,
          metadata: {
            provider: row.provider,
            reason: input.reason.trim(),
            status: row.status,
          },
        });

        return row;
      });

      if (!invoice) {
        const [existing] = await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId)))
          .limit(1);
        return {
          ok: false,
          error: existing ? "billing_invoice_status_invalid" : "billing_invoice_not_found",
          status: existing ? 400 : 404,
        };
      }

      return {
        ok: true,
        invoice: serializeInvoice(invoice),
      };
    },
  };
}
