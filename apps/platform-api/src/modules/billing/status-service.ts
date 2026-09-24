import type { createPlatformDb } from "@ecs/db";
import { billingPaymentEvidence, invoices, plans, planVersions, subscriptions } from "@ecs/db";
import { desc, eq, sql } from "drizzle-orm";

import type { BillingStatusResult } from "../../types/index.js";
import { createEntitlementService } from "../entitlements/service.js";
import {
  type BillingServicePaymentOptions,
  isFreePlanPrice,
  selectInvoiceFields,
  serializeDate,
  serializeInvoice,
  serializePaymentEvidence,
} from "./invoice-service.js";
import { parseScheduledDowngradePlanId } from "./lifecycle.js";
import type { createBillingPlanService } from "./plan-service.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type BillingPlanService = ReturnType<typeof createBillingPlanService>;

type BillingStatusServiceOptions = {
  db: PlatformDb;
  ensureFreeSubscription: (input: { tenantId: string }) => Promise<unknown>;
  listPlans: BillingPlanService["listPlans"];
  paymentOptions: BillingServicePaymentOptions | undefined;
  syncTenantBillingLifecycle: (input: { tenantId: string }) => Promise<unknown>;
};

type SubscriptionProjection = {
  subscriptionId: string;
  planVersionId: string | null;
  status: string;
  billingCycle: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  manualPaymentState: string;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  planId: string;
  planName: string;
  planPrice: string;
  planLimits: unknown;
  planFeatures: unknown;
};

export function createBillingStatusService({
  db,
  ensureFreeSubscription,
  listPlans,
  paymentOptions,
  syncTenantBillingLifecycle,
}: BillingStatusServiceOptions) {
  const entitlementService = createEntitlementService(db);

  const readSubscription = async (tenantId: string): Promise<SubscriptionProjection | null> => {
    const [subscription] = await db
      .select({
        billingCycle: subscriptions.billingCycle,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        currentPeriodStart: subscriptions.currentPeriodStart,
        manualPaymentState: subscriptions.manualPaymentState,
        planFeatures: sql<unknown>`coalesce(${planVersions.features}, ${plans.features})`,
        planId: plans.id,
        planLimits: sql<unknown>`coalesce(${planVersions.limits}, ${plans.limits})`,
        planName: sql<string>`coalesce(${planVersions.name}, ${plans.name})`,
        planPrice: sql<string>`coalesce(${planVersions.price}, ${plans.price})`,
        planVersionId: subscriptions.planVersionId,
        status: subscriptions.status,
        subscriptionId: subscriptions.id,
        trialEndsAt: subscriptions.trialEndsAt,
        trialStartedAt: subscriptions.trialStartedAt,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);

    return subscription ?? null;
  };

  const buildBillingStatusResult = async (
    subscription: SubscriptionProjection,
    tenantId: string,
  ): Promise<BillingStatusResult> => {
    const invoiceRows = await db
      .select(selectInvoiceFields())
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(invoices.createdAt))
      .limit(20);
    const evidenceRows = await db
      .select({
        createdAt: billingPaymentEvidence.createdAt,
        id: billingPaymentEvidence.id,
        invoiceId: billingPaymentEvidence.invoiceId,
        provider: billingPaymentEvidence.provider,
        reviewReason: billingPaymentEvidence.reviewReason,
        status: billingPaymentEvidence.status,
        submittedReference: billingPaymentEvidence.submittedReference,
        verificationSource: billingPaymentEvidence.verificationSource,
      })
      .from(billingPaymentEvidence)
      .where(eq(billingPaymentEvidence.tenantId, tenantId))
      .orderBy(desc(billingPaymentEvidence.createdAt));
    const latestEvidenceByInvoice = new Map<string, ReturnType<typeof serializePaymentEvidence>>();
    for (const evidence of evidenceRows) {
      if (!latestEvidenceByInvoice.has(evidence.invoiceId)) {
        latestEvidenceByInvoice.set(evidence.invoiceId, serializePaymentEvidence(evidence));
      }
    }

    const planList = await listPlans({ tenantId });
    const catalog = planList.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      isFree: plan.isFree,
      isCurrent: plan.id === subscription.planId,
      limits: plan.limits,
      features: plan.features,
      publicName: plan.publicName,
      summary: plan.summary,
      featureList: plan.featureList,
      trial:
        plan.versionId && plan.trialPolicy.enabled
          ? {
              available:
                subscription.status !== "trialing" && isFreePlanPrice(subscription.planPrice),
              durationDays: plan.trialPolicy.durationDays,
              versionId: plan.versionId,
            }
          : { available: false as const },
    }));
    const availablePaidPlans = planList.plans.filter(
      (plan) => !plan.isFree && plan.id !== subscription.planId,
    );
    const scheduledPlanId = parseScheduledDowngradePlanId(subscription.manualPaymentState);
    const scheduledPlan = scheduledPlanId
      ? (planList.plans.find((plan) => plan.id === scheduledPlanId) ?? null)
      : null;
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
          trialStartedAt: serializeDate(subscription.trialStartedAt),
          trialEndsAt: serializeDate(subscription.trialEndsAt),
          scheduledPlanId: scheduledPlan?.id ?? null,
          scheduledPlanName: scheduledPlan?.name ?? null,
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
        invoices: invoiceRows.map((invoice) => ({
          ...serializeInvoice(invoice),
          paymentEvidence: latestEvidenceByInvoice.get(invoice.id) ?? null,
        })),
        paymentDestinations: paymentOptions?.paymentDestinations ?? [],
        availablePaidPlans: availablePaidPlans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          price: String(plan.price),
          limits: plan.limits ?? {},
          features: plan.features ?? {},
          publicName: plan.publicName,
          summary: plan.summary,
          featureList: plan.featureList,
          trial:
            plan.versionId && plan.trialPolicy.enabled
              ? {
                  available:
                    subscription.status !== "trialing" && isFreePlanPrice(subscription.planPrice),
                  durationDays: plan.trialPolicy.durationDays,
                  versionId: plan.versionId,
                }
              : { available: false as const },
        })),
        catalog,
      },
    };
  };

  return {
    getBillingStatus: async (input: { tenantId: string }): Promise<BillingStatusResult> => {
      await ensureFreeSubscription(input);
      try {
        await syncTenantBillingLifecycle(input);
      } catch {
        // Lifecycle repair is best-effort and must not block the billing page.
      }

      let subscription = await readSubscription(input.tenantId);
      if (!subscription) {
        // Handle a concurrent first-subscription insert by making one bounded retry.
        await ensureFreeSubscription(input);
        subscription = await readSubscription(input.tenantId);
      }
      if (!subscription) return { ok: false, error: "billing_not_found" };

      return buildBillingStatusResult(subscription, input.tenantId);
    },
  };
}
