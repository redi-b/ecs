import { createHash } from "node:crypto";

import {
  type PlanId,
  type PlanVersionId,
  type PublishedPlanVersion,
  publishPlanVersion,
  type TrialPolicy,
} from "@ecs/billing";
import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  invoices,
  planDrafts,
  planPresentations,
  plans,
  planVersions,
  subscriptions,
  tenants,
} from "@ecs/db";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

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
  trialPolicy?: unknown;
};

export type ValidPlanDraft = {
  billingInterval: BillingInterval;
  currency: string;
  features: PlanEntitlements;
  limits: { products?: number };
  name: string;
  price: string;
  priceMinor: number;
  trialPolicy: TrialPolicy;
};

export type PlanPresentationInput = {
  badge: string | null;
  ctaLabel: string;
  description: string;
  displayOrder: number;
  featureList: unknown;
  featured: boolean;
  landingVisible: boolean;
  publicName: string;
  summary: string;
  visibility: "public" | "private";
};

export type PlanAdministrationError =
  | "plan_admin_invalid"
  | "plan_admin_code_conflict"
  | "plan_admin_plan_not_found"
  | "plan_admin_draft_not_found"
  | "plan_admin_version_not_found"
  | "plan_admin_subscription_not_found"
  | "plan_admin_subscription_unchanged";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseTrialPolicy(value: unknown): TrialPolicy | null {
  if (value == null) return { enabled: false };
  if (!isPlainRecord(value) || typeof value.enabled !== "boolean") return null;
  if (!value.enabled) return { enabled: false };
  if (
    (value.activation !== "automatic" && value.activation !== "manual") ||
    !Number.isSafeInteger(value.durationDays) ||
    Number(value.durationDays) < 1 ||
    Number(value.durationDays) > 365 ||
    (value.eligibilityScope !== "tenant" && value.eligibilityScope !== "account") ||
    typeof value.fallbackPlanVersionId !== "string" ||
    !value.fallbackPlanVersionId ||
    typeof value.paymentMethodRequired !== "boolean"
  ) {
    return null;
  }
  return {
    activation: value.activation,
    durationDays: Number(value.durationDays),
    eligibilityScope: value.eligibilityScope,
    enabled: true,
    fallbackPlanVersionId: value.fallbackPlanVersionId as PlanVersionId,
    paymentMethodRequired: value.paymentMethodRequired,
  };
}

function parsePresentation(input: PlanPresentationInput) {
  const publicName = input.publicName.trim();
  const summary = input.summary.trim();
  const description = input.description.trim();
  const ctaLabel = input.ctaLabel.trim();
  const badge = input.badge?.trim() || null;
  if (
    publicName.length < 2 ||
    summary.length > 180 ||
    description.length > 2_000 ||
    ctaLabel.length < 2 ||
    ctaLabel.length > 60 ||
    (badge?.length ?? 0) > 40 ||
    !Number.isSafeInteger(input.displayOrder) ||
    input.displayOrder < 0 ||
    !Array.isArray(input.featureList) ||
    input.featureList.length > 20
  ) {
    return null;
  }
  const featureList = input.featureList.map((item) =>
    typeof item === "string" ? item.trim() : "",
  );
  if (featureList.some((item) => item.length < 2 || item.length > 120)) return null;
  return {
    badge,
    ctaLabel,
    description,
    displayOrder: input.displayOrder,
    featureList,
    featured: input.featured,
    landingVisible: input.landingVisible,
    publicName,
    summary,
    visibility: input.visibility,
  };
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
  const trialPolicy = parseTrialPolicy(input.trialPolicy);
  if (!trialPolicy) return null;
  if (
    isPlainRecord(input.trialPolicy) &&
    input.trialPolicy.enabled === true &&
    !trialPolicy.enabled
  ) {
    return null;
  }
  if (
    trialPolicy.enabled &&
    (trialPolicy.paymentMethodRequired ||
      (trialPolicy.activation === "automatic" && trialPolicy.eligibilityScope !== "tenant"))
  ) {
    return null;
  }
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
    trialPolicy,
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
          code: plans.code,
          kind: plans.kind,
          visibility: plans.visibility,
          tenantId: plans.tenantId,
          basePlanVersionId: plans.basePlanVersionId,
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
      const presentationRows = await db.select().from(planPresentations);
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
      const presentationsByPlan = new Map(
        presentationRows.map((presentation) => [presentation.planId, presentation]),
      );
      const countsByPlan = new Map(subscriptionCounts.map((item) => [item.planId, item.count]));

      return {
        plans: planRows.map((plan) => {
          const versions = versionsByPlan.get(plan.id) ?? [];
          const draft = draftsByPlan.get(plan.id);
          const presentation = presentationsByPlan.get(plan.id);
          return {
            code: plan.code,
            kind: plan.kind,
            visibility: plan.visibility,
            tenantId: plan.tenantId,
            basePlanVersionId: plan.basePlanVersionId,
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
                  trialPolicy: parseTrialPolicy(versions[0].trialPolicy) ?? { enabled: false },
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
              trialPolicy: parseTrialPolicy(version.trialPolicy) ?? { enabled: false },
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
                  trialPolicy: parseTrialPolicy(draft.trialPolicy) ?? { enabled: false },
                  updatedAt: draft.updatedAt.toISOString(),
                }
              : null,
            presentation: presentation
              ? {
                  badge: presentation.badge,
                  ctaLabel: presentation.ctaLabel,
                  description: presentation.description,
                  displayOrder: presentation.displayOrder,
                  featureList: presentation.featureList,
                  featured: presentation.featured,
                  landingVisible: presentation.landingVisible,
                  publicName: presentation.publicName,
                  summary: presentation.summary,
                  updatedAt: presentation.updatedAt.toISOString(),
                }
              : null,
          };
        }),
      };
    },

    createPlan: async (input: {
      actorUserId: string;
      basePlanVersionId: string | null;
      code: string;
      draft: PlanDraftInput;
      kind: "standard" | "custom";
      platformPrincipalId: string;
      reason: string;
      tenantId: string | null;
      visibility: "public" | "private";
    }) => {
      const code = input.code.trim().toLowerCase();
      const draft = validatePlanDraft(input.draft);
      const reason = validReason(input.reason);
      if (
        !draft ||
        !reason ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code) ||
        code.length > 64 ||
        (input.kind === "standard" && (input.tenantId || input.basePlanVersionId)) ||
        (input.kind === "custom" && (!input.tenantId || !input.basePlanVersionId)) ||
        (input.kind === "custom" && input.visibility !== "private") ||
        (draft.trialPolicy.enabled && draft.priceMinor === 0)
      ) {
        return { ok: false as const, error: "plan_admin_invalid" as const, status: 400 as const };
      }
      return db.transaction(async (transaction) => {
        if (input.kind === "custom") {
          const tenantId = input.tenantId;
          const basePlanVersionId = input.basePlanVersionId;
          if (!tenantId || !basePlanVersionId) {
            return {
              ok: false as const,
              error: "plan_admin_invalid" as const,
              status: 400 as const,
            };
          }
          const [[tenant], [baseVersion]] = await Promise.all([
            transaction.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)),
            transaction
              .select({ id: planVersions.id })
              .from(planVersions)
              .where(eq(planVersions.id, basePlanVersionId)),
          ]);
          if (!tenant || !baseVersion) {
            return {
              ok: false as const,
              error: "plan_admin_invalid" as const,
              status: 400 as const,
            };
          }
        }
        if (draft.trialPolicy.enabled) {
          const [fallback] = await transaction
            .select({ price: planVersions.price })
            .from(planVersions)
            .where(eq(planVersions.id, draft.trialPolicy.fallbackPlanVersionId))
            .limit(1);
          if (!fallback || Number(fallback.price) !== 0) {
            return {
              ok: false as const,
              error: "plan_admin_invalid" as const,
              status: 400 as const,
            };
          }
        }
        const [existing] = await transaction
          .select({ id: plans.id })
          .from(plans)
          .where(eq(plans.code, code))
          .limit(1);
        if (existing) {
          return {
            ok: false as const,
            error: "plan_admin_code_conflict" as const,
            status: 409 as const,
          };
        }
        const [created] = await transaction
          .insert(plans)
          .values({
            basePlanVersionId: input.basePlanVersionId,
            code,
            features: draft.features,
            kind: input.kind,
            limits: draft.limits,
            name: draft.name,
            price: draft.price,
            status: "draft",
            tenantId: input.tenantId,
            visibility: input.visibility,
          })
          .returning({ id: plans.id });
        if (!created) throw new Error("Plan insert returned no row.");
        await transaction.insert(planDrafts).values({
          billingInterval: draft.billingInterval,
          currency: draft.currency,
          features: draft.features,
          limits: draft.limits,
          name: draft.name,
          planId: created.id,
          price: draft.price,
          trialPolicy: draft.trialPolicy,
          updatedByUserId: input.actorUserId,
        });
        await transaction.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          platformPrincipalId: input.platformPrincipalId,
          action: "billing.plan_created",
          targetType: "plan",
          targetId: created.id,
          metadata: { code, kind: input.kind, reason, tenantId: input.tenantId },
        });
        return { ok: true as const, planId: created.id };
      });
    },

    savePresentation: async (input: {
      actorUserId: string;
      planId: string;
      platformPrincipalId: string;
      presentation: PlanPresentationInput;
      reason: string;
    }) => {
      const presentation = parsePresentation(input.presentation);
      const reason = validReason(input.reason);
      if (!presentation || !reason) {
        return { ok: false as const, error: "plan_admin_invalid" as const, status: 400 as const };
      }
      return db.transaction(async (transaction) => {
        const presentationValues = {
          badge: presentation.badge,
          ctaLabel: presentation.ctaLabel,
          description: presentation.description,
          displayOrder: presentation.displayOrder,
          featureList: presentation.featureList,
          featured: presentation.featured,
          landingVisible: presentation.landingVisible,
          publicName: presentation.publicName,
          summary: presentation.summary,
        };
        const [plan] = await transaction
          .select({ id: plans.id, kind: plans.kind, visibility: plans.visibility })
          .from(plans)
          .where(eq(plans.id, input.planId))
          .limit(1);
        if (!plan) {
          return {
            ok: false as const,
            error: "plan_admin_plan_not_found" as const,
            status: 404 as const,
          };
        }
        if (
          presentation.landingVisible &&
          (plan.kind !== "standard" || presentation.visibility !== "public")
        ) {
          return { ok: false as const, error: "plan_admin_invalid" as const, status: 400 as const };
        }
        await transaction
          .update(plans)
          .set({ visibility: presentation.visibility })
          .where(eq(plans.id, input.planId));
        const [saved] = await transaction
          .insert(planPresentations)
          .values({
            ...presentationValues,
            planId: input.planId,
            updatedByUserId: input.actorUserId,
          })
          .onConflictDoUpdate({
            target: planPresentations.planId,
            set: {
              ...presentationValues,
              updatedAt: new Date(),
              updatedByUserId: input.actorUserId,
            },
          })
          .returning({ id: planPresentations.id });
        if (!saved) throw new Error("Plan presentation upsert returned no row.");
        await transaction.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          platformPrincipalId: input.platformPrincipalId,
          action: "billing.plan_presentation_updated",
          targetType: "plan",
          targetId: input.planId,
          metadata: {
            landingVisible: presentation.landingVisible,
            reason,
            visibility: presentation.visibility,
          },
        });
        return { ok: true as const, presentationId: saved.id };
      });
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
      if (draft.trialPolicy.enabled && draft.priceMinor === 0) {
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
        if (draft.trialPolicy.enabled) {
          const [fallback] = await transaction
            .select({ price: planVersions.price })
            .from(planVersions)
            .where(eq(planVersions.id, draft.trialPolicy.fallbackPlanVersionId))
            .limit(1);
          if (!fallback || Number(fallback.price) !== 0) {
            return {
              ok: false as const,
              error: "plan_admin_invalid" as const,
              status: 400 as const,
            };
          }
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
            trialPolicy: draft.trialPolicy,
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
              trialPolicy: draft.trialPolicy,
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
          trialPolicy: draftRow.trialPolicy,
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
                trialPolicy: parseTrialPolicy(latestRow.trialPolicy) ?? { enabled: false },
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
            trialPolicy: draft.trialPolicy,
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
            trialPolicy: draft.trialPolicy,
            publishedAt: publication.version.publishedAt,
          });
          await transaction
            .update(plans)
            .set({
              name: draft.name,
              price: draft.price,
              limits: draft.limits,
              features: draft.features,
              status: "active",
            })
            .where(eq(plans.id, input.planId));
          await transaction
            .update(subscriptions)
            .set({
              renewalPlanVersionId: publication.version.id,
              renewalEffectiveAt: sql`
                case when exists (
                  select 1 from ${invoices}
                  where ${invoices.subscriptionId} = ${subscriptions.id}
                    and ${invoices.status} = 'pending'
                ) then coalesce(${subscriptions.currentPeriodEnd}, now())
                  + case when ${subscriptions.billingCycle} = 'yearly'
                    then interval '1 year' else interval '1 month' end
                else coalesce(
                  ${subscriptions.currentPeriodEnd},
                  now() + case when ${subscriptions.billingCycle} = 'yearly'
                    then interval '1 year' else interval '1 month' end
                ) end
              `,
            })
            .where(
              and(
                eq(subscriptions.planId, input.planId),
                ne(subscriptions.planVersionId, publication.version.id),
                inArray(subscriptions.status, ["active", "past_due"]),
              ),
            );
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
            kind: plans.kind,
            ownerTenantId: plans.tenantId,
            planId: planVersions.planId,
            version: planVersions.version,
          })
          .from(planVersions)
          .innerJoin(plans, eq(plans.id, planVersions.planId))
          .where(eq(planVersions.id, input.planVersionId))
          .limit(1);
        if (!target) {
          return {
            ok: false as const,
            error: "plan_admin_version_not_found" as const,
            status: 404 as const,
          };
        }
        if (target.kind === "custom" && target.ownerTenantId !== input.tenantId) {
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
