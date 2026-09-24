import { createHash } from "node:crypto";

import {
  type PlanId,
  type PlanVersionId,
  type PublishedPlanVersion,
  parseTrialPolicy,
  publishPlanVersion,
} from "@ecs/billing";
import type { createPlatformDb } from "@ecs/db";
import { planPresentations, plans, planVersions } from "@ecs/db";
import { and, desc, eq, isNull, or } from "drizzle-orm";

import {
  ENTITLEMENT_CATALOG,
  type PlanEntitlements,
  parsePlanEntitlements,
} from "../entitlements/catalog.js";
import { isFreePlanPrice } from "./invoice-service.js";
import { DEFAULT_PLANS, getDefaultPlanPresentation } from "./plan-catalog.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createBillingPlanService(db: PlatformDb) {
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
        trialPolicy: planVersions.trialPolicy,
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
        trialPolicy: parseTrialPolicy(row.trialPolicy),
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
        trialPolicy: { enabled: false },
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
          trialPolicy: publication.version.terms.trialPolicy,
          publishedAt: publication.version.publishedAt,
        })
        .onConflictDoNothing();
    }
    return (await latestPlanVersion(plan.id)) ?? publication.version;
  };

  const ensureDefaultPlans = async () => {
    for (const plan of DEFAULT_PLANS) {
      await db
        .insert(plans)
        .values(plan)
        .onConflictDoUpdate({
          target: plans.id,
          set: {
            // Transitional latest-version projection for legacy readers.
            features: plan.features,
            code: plan.code,
            kind: plan.kind,
            limits: plan.limits,
            name: plan.name,
            price: plan.price,
            status: plan.status,
            visibility: plan.visibility,
          },
        });
      await ensurePublishedPlanVersion(plan);
    }
  };

  const listPlans = async (input?: { tenantId?: string }) => {
    await ensureDefaultPlans();
    const rows = await db
      .select({
        id: plans.id,
        name: plans.name,
        price: plans.price,
        limits: plans.limits,
        features: plans.features,
        kind: plans.kind,
        status: plans.status,
        tenantId: plans.tenantId,
        visibility: plans.visibility,
        publicName: planPresentations.publicName,
        summary: planPresentations.summary,
        featureList: planPresentations.featureList,
      })
      .from(plans)
      .leftJoin(planPresentations, eq(planPresentations.planId, plans.id))
      .where(
        and(
          eq(plans.status, "active"),
          input?.tenantId
            ? or(
                and(eq(plans.kind, "standard"), eq(plans.visibility, "public")),
                and(eq(plans.kind, "custom"), eq(plans.tenantId, input.tenantId)),
              )
            : eq(plans.kind, "standard"),
        ),
      )
      .orderBy(plans.price);

    const availablePlans = await Promise.all(
      rows.map(async (plan) => {
        const version = await latestPlanVersion(plan.id);
        const trialPolicy = version?.terms.trialPolicy ?? null;
        return {
          id: plan.id,
          name: plan.name,
          price: plan.price,
          limits: plan.limits,
          features: plan.features,
          kind: plan.kind,
          status: plan.status,
          tenantId: plan.tenantId,
          visibility: plan.visibility,
          isFree: isFreePlanPrice(plan.price),
          versionId: version?.id ?? null,
          trialPolicy: trialPolicy ?? { enabled: false as const },
          publicName: plan.publicName,
          summary: plan.summary,
          featureList: Array.isArray(plan.featureList)
            ? plan.featureList.filter((item): item is string => typeof item === "string")
            : [],
        };
      }),
    );
    return {
      ok: true as const,
      plans: availablePlans,
    };
  };

  const getPublicPlanCatalog = async () => {
    const rows = await db
      .select({
        presentationId: planPresentations.id,
        badge: planPresentations.badge,
        billingInterval: planVersions.billingInterval,
        code: plans.code,
        ctaLabel: planPresentations.ctaLabel,
        currency: planVersions.currency,
        description: planPresentations.description,
        displayOrder: planPresentations.displayOrder,
        featureList: planPresentations.featureList,
        featured: planPresentations.featured,
        name: planPresentations.publicName,
        planId: plans.id,
        price: planVersions.price,
        summary: planPresentations.summary,
        trialPolicy: planVersions.trialPolicy,
        version: planVersions.version,
      })
      .from(plans)
      .leftJoin(planPresentations, eq(planPresentations.planId, plans.id))
      .innerJoin(planVersions, eq(planVersions.planId, plans.id))
      .where(
        and(
          eq(plans.kind, "standard"),
          eq(plans.status, "active"),
          eq(plans.visibility, "public"),
          or(eq(planPresentations.landingVisible, true), isNull(planPresentations.id)),
        ),
      )
      .orderBy(planPresentations.displayOrder, plans.name, desc(planVersions.version));
    const latestByPlan = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!latestByPlan.has(row.planId)) latestByPlan.set(row.planId, row);
    return {
      plans: [...latestByPlan.values()].flatMap((row) => {
        const presentation = row.presentationId
          ? {
              badge: row.badge,
              ctaLabel: row.ctaLabel ?? "Choose plan",
              description: row.description ?? "",
              displayOrder: row.displayOrder ?? 0,
              featureList: row.featureList ?? [],
              featured: row.featured ?? false,
              publicName: row.name ?? row.code,
              summary: row.summary ?? "",
            }
          : getDefaultPlanPresentation(row.code);
        if (!presentation) return [];
        const trial = parseTrialPolicy(row.trialPolicy);
        return [
          {
            badge: presentation.badge,
            billingInterval:
              row.billingInterval === "day" ||
              row.billingInterval === "week" ||
              row.billingInterval === "year"
                ? row.billingInterval
                : ("month" as const),
            code: row.code,
            ctaLabel: presentation.ctaLabel,
            currency: row.currency,
            description: presentation.description,
            displayOrder: presentation.displayOrder,
            featureList: Array.isArray(presentation.featureList)
              ? presentation.featureList.filter((item): item is string => typeof item === "string")
              : [],
            featured: presentation.featured,
            name: presentation.publicName,
            price: String(row.price),
            summary: presentation.summary,
            trial: trial.enabled
              ? {
                  activation: trial.activation,
                  available: true as const,
                  durationDays: trial.durationDays,
                  paymentMethodRequired: trial.paymentMethodRequired,
                }
              : { available: false as const },
          },
        ];
      }),
    };
  };

  return {
    ensureDefaultPlans,
    ensurePublishedPlanVersion,
    getPublicPlanCatalog,
    latestPlanVersion,
    listPlans,
  };
}
