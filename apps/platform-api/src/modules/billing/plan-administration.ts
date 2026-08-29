import { createHash } from "node:crypto";

import {
  type PlanId,
  type PlanVersionId,
  type PublishedPlanVersion,
  publishPlanVersion,
} from "@ecs/billing";
import type { createPlatformDb } from "@ecs/db";
import { auditLogs, planDrafts, plans, planVersions, subscriptions } from "@ecs/db";
import { and, desc, eq, sql } from "drizzle-orm";

import {
  ENTITLEMENT_CATALOG,
  ENTITLEMENT_KEYS,
  type PlanEntitlements,
} from "../entitlements/catalog.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type BillingInterval = "day" | "week" | "month" | "year";

export type PlanDraftInput = {
  billingInterval: BillingInterval;
  currency: string;
  features: unknown;
  limits: unknown;
  name: string;
  price: string;
};

export type ValidPlanDraft = {
  billingInterval: BillingInterval;
  currency: string;
  features: PlanEntitlements;
  limits: { products?: number };
  name: string;
  price: string;
  priceMinor: number;
};

export type PlanAdministrationError =
  | "plan_admin_invalid"
  | "plan_admin_plan_not_found"
  | "plan_admin_draft_not_found"
  | "plan_admin_version_not_found"
  | "plan_admin_subscription_not_found"
  | "plan_admin_subscription_unchanged";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validatePlanDraft(input: PlanDraftInput): ValidPlanDraft | null {
  const name = input.name.trim();
  const currency = input.currency.trim().toUpperCase();
  const price = input.price.trim();
  if (name.length < 2 || !/^[A-Z]{3}$/.test(currency) || !/^\d+(?:\.\d{1,2})?$/.test(price)) {
    return null;
  }
  const priceMinor = Math.round(Number(price) * 100);
  if (!Number.isSafeInteger(priceMinor) || priceMinor < 0) return null;
  if (!isPlainRecord(input.features)) return null;
  if (
    Object.keys(input.features).sort().join("\u0000") !==
    [...ENTITLEMENT_KEYS].sort().join("\u0000")
  ) {
    return null;
  }
  const featureSource = input.features;
  const features = Object.fromEntries(
    ENTITLEMENT_KEYS.map((key) => [key, featureSource[key]]),
  ) as Record<string, unknown>;
  if (ENTITLEMENT_KEYS.some((key) => typeof features[key] !== "boolean")) return null;

  if (!isPlainRecord(input.limits)) return null;
  const limitKeys = Object.keys(input.limits);
  if (limitKeys.some((key) => key !== "products")) return null;
  const productLimit = input.limits.products;
  if (
    productLimit !== undefined &&
    (typeof productLimit !== "number" || !Number.isSafeInteger(productLimit) || productLimit < 0)
  ) {
    return null;
  }

  return {
    billingInterval: input.billingInterval,
    currency,
    features: features as PlanEntitlements,
    limits: productLimit === undefined ? {} : { products: productLimit },
    name,
    price,
    priceMinor,
  };
}

function validReason(reason: string) {
  const normalized = reason.trim();
  return normalized.length >= 10 ? normalized : null;
}

export function createPlanAdministrationService(db: PlatformDb) {
  return {
    getCatalog: async () => {
      const planRows = await db
        .select({
          id: plans.id,
          name: plans.name,
          price: plans.price,
          status: plans.status,
          limits: plans.limits,
          features: plans.features,
        })
        .from(plans)
        .orderBy(plans.price, plans.name);
      const versionRows = await db
        .select()
        .from(planVersions)
        .orderBy(planVersions.planId, desc(planVersions.version));
      const draftRows = await db.select().from(planDrafts);
      const subscriptionCounts = await db
        .select({ planId: subscriptions.planId, count: sql<number>`count(*)::int` })
        .from(subscriptions)
        .groupBy(subscriptions.planId);

      const versionsByPlan = new Map<string, typeof versionRows>();
      for (const version of versionRows) {
        const versions = versionsByPlan.get(version.planId) ?? [];
        versions.push(version);
        versionsByPlan.set(version.planId, versions);
      }
      const draftsByPlan = new Map(draftRows.map((draft) => [draft.planId, draft]));
      const countsByPlan = new Map(subscriptionCounts.map((item) => [item.planId, item.count]));

      return {
        plans: planRows.map((plan) => {
          const versions = versionsByPlan.get(plan.id) ?? [];
          const draft = draftsByPlan.get(plan.id);
          return {
            id: plan.id,
            name: plan.name,
            price: String(plan.price),
            status: plan.status,
            features: plan.features,
            limits: plan.limits,
            subscriptionCount: countsByPlan.get(plan.id) ?? 0,
            latestVersion: versions[0]
              ? {
                  id: versions[0].id,
                  version: versions[0].version,
                  name: versions[0].name,
                  price: String(versions[0].price),
                  currency: versions[0].currency,
                  billingInterval: versions[0].billingInterval,
                  features: versions[0].features,
                  limits: versions[0].limits,
                  publishedAt: versions[0].publishedAt.toISOString(),
                }
              : null,
            versions: versions.map((version) => ({
              id: version.id,
              version: version.version,
              name: version.name,
              price: String(version.price),
              currency: version.currency,
              billingInterval: version.billingInterval,
              publishedAt: version.publishedAt.toISOString(),
            })),
            draft: draft
              ? {
                  id: draft.id,
                  revision: draft.revision,
                  name: draft.name,
                  price: String(draft.price),
                  currency: draft.currency,
                  billingInterval: draft.billingInterval,
                  features: draft.features,
                  limits: draft.limits,
                  updatedAt: draft.updatedAt.toISOString(),
                }
              : null,
          };
        }),
      };
    },

    saveDraft: async (input: {
      actorUserId: string;
      draft: PlanDraftInput;
      planId: string;
      platformPrincipalId: string;
      reason: string;
    }) => {
      const draft = validatePlanDraft(input.draft);
      const reason = validReason(input.reason);
      if (!draft || !reason) {
        return { ok: false as const, error: "plan_admin_invalid" as const, status: 400 as const };
      }
      return db.transaction(async (transaction) => {
        const [plan] = await transaction
          .select({ id: plans.id })
          .from(plans)
          .where(eq(plans.id, input.planId));
        if (!plan) {
          return {
            ok: false as const,
            error: "plan_admin_plan_not_found" as const,
            status: 404 as const,
          };
        }
        const [saved] = await transaction
          .insert(planDrafts)
          .values({
            planId: input.planId,
            name: draft.name,
            price: draft.price,
            currency: draft.currency,
            billingInterval: draft.billingInterval,
            features: draft.features,
            limits: draft.limits,
            updatedByUserId: input.actorUserId,
          })
          .onConflictDoUpdate({
            target: planDrafts.planId,
            set: {
              revision: sql`${planDrafts.revision} + 1`,
              name: draft.name,
              price: draft.price,
              currency: draft.currency,
              billingInterval: draft.billingInterval,
              features: draft.features,
              limits: draft.limits,
              updatedAt: new Date(),
              updatedByUserId: input.actorUserId,
            },
          })
          .returning({ id: planDrafts.id, revision: planDrafts.revision });
        if (!saved) throw new Error("Plan draft upsert returned no row.");
        await transaction.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          platformPrincipalId: input.platformPrincipalId,
          action: "billing.plan_draft_saved",
          targetType: "plan_draft",
          targetId: saved.id,
          metadata: { planId: input.planId, reason, revision: saved.revision },
        });
        return { ok: true as const, draft: saved };
      });
    },

    publishDraft: async (input: {
      actorUserId: string;
      planId: string;
      platformPrincipalId: string;
      reason: string;
    }) => {
      const reason = validReason(input.reason);
      if (!reason) {
        return { ok: false as const, error: "plan_admin_invalid" as const, status: 400 as const };
      }
      return db.transaction(async (transaction) => {
        const [plan] = await transaction
          .select({ id: plans.id })
          .from(plans)
          .where(eq(plans.id, input.planId))
          .for("update");
        if (!plan) {
          return {
            ok: false as const,
            error: "plan_admin_plan_not_found" as const,
            status: 404 as const,
          };
        }
        const [draftRow] = await transaction
          .select()
          .from(planDrafts)
          .where(eq(planDrafts.planId, input.planId))
          .limit(1);
        if (!draftRow) {
          return {
            ok: false as const,
            error: "plan_admin_draft_not_found" as const,
            status: 404 as const,
          };
        }
        const draft = validatePlanDraft({
          billingInterval:
            draftRow.billingInterval === "day" ||
            draftRow.billingInterval === "week" ||
            draftRow.billingInterval === "year"
              ? draftRow.billingInterval
              : "month",
          currency: draftRow.currency,
          features: draftRow.features,
          limits: draftRow.limits,
          name: draftRow.name,
          price: draftRow.price,
        });
        if (!draft) {
          return { ok: false as const, error: "plan_admin_invalid" as const, status: 400 as const };
        }
        const [latestRow] = await transaction
          .select()
          .from(planVersions)
          .where(eq(planVersions.planId, input.planId))
          .orderBy(desc(planVersions.version))
          .limit(1);
        const latest: PublishedPlanVersion<typeof ENTITLEMENT_CATALOG> | null = latestRow
          ? {
              fingerprint: latestRow.fingerprint,
              id: latestRow.id as PlanVersionId,
              planId: latestRow.planId as PlanId,
              publishedAt: latestRow.publishedAt,
              terms: {
                capabilities: latestRow.features as PlanEntitlements,
                currency: latestRow.currency,
                interval:
                  latestRow.billingInterval === "day" ||
                  latestRow.billingInterval === "week" ||
                  latestRow.billingInterval === "year"
                    ? latestRow.billingInterval
                    : "month",
                priceMinor: Math.round(Number(latestRow.price) * 100),
              },
              version: latestRow.version,
            }
          : null;
        const publication = await publishPlanVersion({
          catalog: ENTITLEMENT_CATALOG,
          fingerprint: {
            digest: async (canonicalTerms) =>
              createHash("sha256").update(canonicalTerms).digest("hex"),
          },
          identifiers: { create: () => crypto.randomUUID() as PlanVersionId },
          latest,
          now: new Date(),
          planId: input.planId as PlanId,
          terms: {
            capabilities: draft.features,
            currency: draft.currency,
            interval: draft.billingInterval,
            priceMinor: draft.priceMinor,
          },
        });
        if (publication.action === "published") {
          await transaction.insert(planVersions).values({
            id: publication.version.id,
            planId: input.planId,
            version: publication.version.version,
            fingerprint: publication.version.fingerprint,
            name: draft.name,
            price: draft.price,
            currency: draft.currency,
            billingInterval: draft.billingInterval,
            limits: draft.limits,
            features: draft.features,
            publishedAt: publication.version.publishedAt,
          });
          await transaction
            .update(plans)
            .set({
              name: draft.name,
              price: draft.price,
              limits: draft.limits,
              features: draft.features,
            })
            .where(eq(plans.id, input.planId));
        }
        await transaction.delete(planDrafts).where(eq(planDrafts.id, draftRow.id));
        await transaction.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          platformPrincipalId: input.platformPrincipalId,
          action: "billing.plan_version_published",
          targetType: "plan_version",
          targetId: publication.version.id,
          metadata: {
            action: publication.action,
            planId: input.planId,
            reason,
            version: publication.version.version,
          },
        });
        return { ok: true as const, publication };
      });
    },

    migrateSubscriptionNow: async (input: {
      actorUserId: string;
      platformPrincipalId: string;
      planVersionId: string;
      reason: string;
      tenantId: string;
    }) => {
      const reason = validReason(input.reason);
      if (!reason) {
        return { ok: false as const, error: "plan_admin_invalid" as const, status: 400 as const };
      }
      return db.transaction(async (transaction) => {
        const [target] = await transaction
          .select({
            id: planVersions.id,
            planId: planVersions.planId,
            version: planVersions.version,
          })
          .from(planVersions)
          .where(eq(planVersions.id, input.planVersionId))
          .limit(1);
        if (!target) {
          return {
            ok: false as const,
            error: "plan_admin_version_not_found" as const,
            status: 404 as const,
          };
        }
        const [current] = await transaction
          .select({
            id: subscriptions.id,
            planId: subscriptions.planId,
            planVersionId: subscriptions.planVersionId,
          })
          .from(subscriptions)
          .where(eq(subscriptions.tenantId, input.tenantId))
          .for("update");
        if (!current) {
          return {
            ok: false as const,
            error: "plan_admin_subscription_not_found" as const,
            status: 404 as const,
          };
        }
        if (current.planVersionId === target.id) {
          return {
            ok: false as const,
            error: "plan_admin_subscription_unchanged" as const,
            status: 400 as const,
          };
        }
        await transaction
          .update(subscriptions)
          .set({ planId: target.planId, planVersionId: target.id })
          .where(and(eq(subscriptions.id, current.id), eq(subscriptions.tenantId, input.tenantId)));
        await transaction.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          platformPrincipalId: input.platformPrincipalId,
          tenantId: input.tenantId,
          action: "billing.subscription_plan_version_migrated",
          targetType: "subscription",
          targetId: current.id,
          metadata: {
            fromPlanId: current.planId,
            fromPlanVersionId: current.planVersionId,
            reason,
            toPlanId: target.planId,
            toPlanVersionId: target.id,
            toVersion: target.version,
          },
        });
        return { ok: true as const, subscriptionId: current.id };
      });
    },
  };
}
