import {
  addBillingInterval,
  BILLING_RENEWAL_LEAD_DAYS,
  type BillingInterval,
  encodeScheduledDowngrade,
  MS_PER_DAY,
  parseScheduledDowngradePlanId,
  parseTrialPolicy,
} from "@ecs/billing";
import type { createPlatformDb } from "@ecs/db";
import {
  billingOutboxEvents,
  billingPaymentEvidence,
  invoices,
  plans,
  planVersions,
  subscriptions,
  subscriptionTrials,
  tenants,
} from "@ecs/db";
import { and, desc, eq, sql } from "drizzle-orm";

import type { BillingStatus } from "../../types/index.js";
import {
  type BillingServicePaymentOptions,
  createBillingInvoiceService,
  isFreePlanPrice,
  selectInvoiceFields,
  serializeDate,
} from "./invoice-service.js";
import { createBillingLifecycleRunner } from "./lifecycle-runner.js";
import { createBillingSubscriptionLifecycleService } from "./subscription-lifecycle-service.js";
import { DEFAULT_PLAN_CATALOG, DEFAULT_PLAN_IDS } from "./plan-catalog.js";
import { createBillingPlanService } from "./plan-service.js";
import { createBillingStatusService } from "./status-service.js";

export {
  BILLING_CHAPA_TX_PREFIX,
  billingTxRefForInvoice,
  isPlatformBillingTxRef,
} from "./invoice-service.js";
export {
  BILLING_RENEWAL_LEAD_DAYS,
  encodeScheduledDowngrade,
  parseScheduledDowngradePlanId,
  planBillingLifecycle,
  SCHEDULED_DOWNGRADE_PREFIX,
} from "@ecs/billing";
export { DEFAULT_PLAN_IDS } from "./plan-catalog.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
export function createBillingService(db: PlatformDb, options?: BillingServicePaymentOptions) {
  const planService = createBillingPlanService(db);
  const latestPlanVersion = planService.latestPlanVersion;
  const ensurePublishedPlanVersion = planService.ensurePublishedPlanVersion;
  const self = () => createBillingService(db, options);

  const invoiceService = createBillingInvoiceService({
    db,
    options,
    ensureFreeSubscription: (input) => self().ensureFreeSubscription(input),
    ensurePendingPlanInvoice: (input) => self().ensurePendingPlanInvoice(input),
    latestPlanVersion,
  });
  const statusService = createBillingStatusService({
    db,
    ensureFreeSubscription: (input) => self().ensureFreeSubscription(input),
    listPlans: planService.listPlans,
    paymentOptions: options,
    syncTenantBillingLifecycle: (input) => self().syncTenantBillingLifecycle(input),
  });
  const subscriptionLifecycleService = createBillingSubscriptionLifecycleService({
    applyScheduledDowngrade: (input) => self().applyScheduledDowngrade(input),
    db,
  });
  const runBillingLifecycle = createBillingLifecycleRunner({
    db,
    syncTenantBillingLifecycle: (input) => self().syncTenantBillingLifecycle(input),
  });

  return {
    listBillingPaymentReviews: async (input: { limit: number; offset: number }) => {
      const limit = Math.min(Math.max(input.limit, 1), 100);
      const offset = Math.max(input.offset, 0);
      const rows = await db
        .select({
          amount: invoices.amount,
          createdAt: billingPaymentEvidence.createdAt,
          currency: invoices.currency,
          evidenceId: billingPaymentEvidence.id,
          invoiceId: invoices.id,
          provider: billingPaymentEvidence.provider,
          reference: billingPaymentEvidence.submittedReference,
          tenantHandle: tenants.handle,
          tenantId: tenants.id,
          tenantName: tenants.name,
          verificationSource: billingPaymentEvidence.verificationSource,
        })
        .from(billingPaymentEvidence)
        .innerJoin(invoices, eq(invoices.id, billingPaymentEvidence.invoiceId))
        .innerJoin(tenants, eq(tenants.id, billingPaymentEvidence.tenantId))
        .where(eq(billingPaymentEvidence.status, "needs_review"))
        .orderBy(desc(billingPaymentEvidence.createdAt))
        .limit(limit)
        .offset(offset);
      const [total] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(billingPaymentEvidence)
        .where(eq(billingPaymentEvidence.status, "needs_review"));
      return {
        count: total?.count ?? 0,
        items: rows.map((row) => ({
          ...row,
          amount: String(row.amount),
          createdAt: row.createdAt.toISOString(),
        })),
      };
    },
    ensureDefaultPlans: planService.ensureDefaultPlans,
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
              currentPeriodEnd: addBillingInterval(new Date(), "month"),
              currentPeriodStart: new Date(),
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
      const starterVersion =
        (await latestPlanVersion(DEFAULT_PLAN_CATALOG.starter.id)) ??
        (await ensurePublishedPlanVersion(DEFAULT_PLAN_CATALOG.starter));
      const [subscription] = await db
        .insert(subscriptions)
        .values({
          tenantId: input.tenantId,
          planId: DEFAULT_PLAN_CATALOG.starter.id,
          planVersionId: starterVersion.id,
          status: "active",
          billingCycle: "monthly",
          currentPeriodStart: now,
          currentPeriodEnd: addBillingInterval(now, starterVersion.terms.interval),
          manualPaymentState: "none",
        })
        .onConflictDoNothing({ target: subscriptions.tenantId })
        .returning({ id: subscriptions.id });

      if (subscription) {
        const automaticCandidates = await db
          .select({
            id: planVersions.id,
            planId: planVersions.planId,
            trialPolicy: planVersions.trialPolicy,
          })
          .from(planVersions)
          .innerJoin(plans, eq(plans.id, planVersions.planId))
          .where(
            and(
              eq(plans.kind, "standard"),
              eq(plans.status, "active"),
              eq(plans.visibility, "public"),
            ),
          )
          .orderBy(desc(planVersions.version));
        const latestSeen = new Set<string>();
        const automatic = automaticCandidates.filter((candidate) => {
          if (latestSeen.has(candidate.planId)) return false;
          latestSeen.add(candidate.planId);
          const policy = parseTrialPolicy(candidate.trialPolicy);
          if (!policy.enabled || policy.activation !== "automatic") return false;
          return true;
        });
        if (automatic.length === 1) {
          const [automaticPlan] = automatic;
          if (!automaticPlan) throw new Error("Automatic trial candidate disappeared.");
          await self().startPlanTrial({
            actorUserId: "system",
            planVersionId: automaticPlan.id,
            tenantId: input.tenantId,
          });
        }
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

    listPlans: planService.listPlans,
    getPublicPlanCatalog: planService.getPublicPlanCatalog,
    ...subscriptionLifecycleService,

    startPlanTrial: async (input: {
      actorUserId: string;
      planVersionId: string;
      tenantId: string;
    }) => {
      return db.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`billing-trial:${input.tenantId}`}, 0))`,
        );
        const [target] = await transaction
          .select({
            kind: plans.kind,
            planId: plans.id,
            planStatus: plans.status,
            price: planVersions.price,
            tenantId: plans.tenantId,
            trialPolicy: planVersions.trialPolicy,
            versionId: planVersions.id,
            visibility: plans.visibility,
          })
          .from(planVersions)
          .innerJoin(plans, eq(plans.id, planVersions.planId))
          .where(eq(planVersions.id, input.planVersionId))
          .limit(1);
        if (!target || target.planStatus !== "active") {
          return {
            ok: false as const,
            error: "billing_trial_not_available" as const,
            status: 404 as const,
          };
        }
        const policy = parseTrialPolicy(target.trialPolicy);
        if (
          !policy.enabled ||
          isFreePlanPrice(target.price) ||
          (target.kind === "standard" && target.visibility !== "public") ||
          (target.kind === "custom" && target.tenantId !== input.tenantId) ||
          policy.paymentMethodRequired
        ) {
          return {
            ok: false as const,
            error: "billing_trial_not_available" as const,
            status: 400 as const,
          };
        }
        const [fallback] = await transaction
          .select({ id: planVersions.id, planId: planVersions.planId, price: planVersions.price })
          .from(planVersions)
          .where(eq(planVersions.id, policy.fallbackPlanVersionId))
          .limit(1);
        if (!fallback || !isFreePlanPrice(fallback.price)) {
          return {
            ok: false as const,
            error: "billing_trial_configuration_invalid" as const,
            status: 409 as const,
          };
        }
        const [subscription] = await transaction
          .select({
            id: subscriptions.id,
            planPrice: sql<string>`coalesce(${planVersions.price}, ${plans.price})`,
            status: subscriptions.status,
          })
          .from(subscriptions)
          .innerJoin(plans, eq(plans.id, subscriptions.planId))
          .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
          .where(eq(subscriptions.tenantId, input.tenantId))
          .limit(1);
        if (
          !subscription ||
          subscription.status === "trialing" ||
          !isFreePlanPrice(subscription.planPrice)
        ) {
          return {
            ok: false as const,
            error: "billing_trial_subscription_ineligible" as const,
            status: 409 as const,
          };
        }
        const eligibilityKey =
          policy.eligibilityScope === "account"
            ? `account:${input.actorUserId}`
            : `tenant:${input.tenantId}`;
        const now = new Date();
        const endsAt = new Date(now.getTime() + policy.durationDays * MS_PER_DAY);
        const [claim] = await transaction
          .insert(subscriptionTrials)
          .values({
            eligibilityKey,
            endsAt,
            fallbackPlanVersionId: fallback.id,
            initiatedByUserId: input.actorUserId,
            planId: target.planId,
            planVersionId: target.versionId,
            startedAt: now,
            subscriptionId: subscription.id,
            tenantId: input.tenantId,
          })
          .onConflictDoNothing({
            target: [subscriptionTrials.planId, subscriptionTrials.eligibilityKey],
          })
          .returning({ id: subscriptionTrials.id });
        if (!claim) {
          return {
            ok: false as const,
            error: "billing_trial_already_used" as const,
            status: 409 as const,
          };
        }
        await transaction
          .update(subscriptions)
          .set({
            currentPeriodEnd: endsAt,
            currentPeriodStart: now,
            manualPaymentState: "trial",
            planId: target.planId,
            planVersionId: target.versionId,
            status: "trialing",
            trialEndsAt: endsAt,
            trialFallbackPlanVersionId: fallback.id,
            trialStartedAt: now,
          })
          .where(eq(subscriptions.id, subscription.id));
        await transaction
          .insert(billingOutboxEvents)
          .values({
            eventKey: `billing.trial_started:${claim.id}`,
            eventType: "billing.trial_started",
            tenantId: input.tenantId,
            payload: {
              durationDays: policy.durationDays,
              endsAt: endsAt.toISOString(),
              planVersionId: target.versionId,
              subscriptionId: subscription.id,
            },
          })
          .onConflictDoNothing({ target: billingOutboxEvents.eventKey });
        return { ok: true as const, endsAt: endsAt.toISOString(), subscriptionId: subscription.id };
      });
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
          currentPeriodEnd: addBillingInterval(now, version.terms.interval),
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
          kind: plans.kind,
          name: plans.name,
          ownerTenantId: plans.tenantId,
          price: plans.price,
          status: plans.status,
          visibility: plans.visibility,
        })
        .from(plans)
        .where(and(eq(plans.id, input.planId), eq(plans.status, "active")))
        .limit(1);

      if (!plan) {
        return { ok: false, error: "billing_plan_not_found", status: 404 };
      }

      if (
        (plan.kind === "standard" && plan.visibility !== "public") ||
        (plan.kind === "custom" && plan.ownerTenantId !== input.tenantId)
      ) {
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
          trialStartedAt: subscriptions.trialStartedAt,
          trialEndsAt: subscriptions.trialEndsAt,
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

    runBillingLifecycle,

    ...statusService,

    /**
     * Self-serve: create (or reuse) a pending invoice to move onto a paid plan.
     * Free plans never get payment invoices. Plan switches only after Chapa pay.
     */
    ...invoiceService,
  };
}
