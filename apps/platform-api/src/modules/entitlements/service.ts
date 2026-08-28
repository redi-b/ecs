import type { createPlatformDb } from "@ecs/db";
import { auditLogs, entitlementOverrides, plans, subscriptions } from "@ecs/db";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { ENTITLEMENT_KEYS, type EntitlementKey, parsePlanEntitlements } from "./catalog.js";

export type { EntitlementKey, PlanEntitlements } from "./catalog.js";
export { ENTITLEMENT_CATALOG, ENTITLEMENT_KEYS, isEntitlementKey } from "./catalog.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type EntitlementDecision = {
  allowed: boolean;
  key: EntitlementKey;
  source: "override" | "plan" | "subscription" | "missing";
  subscriptionStatus: string | null;
};

export type EntitlementOverrideMutationResult =
  | { ok: true; override: { id: string } }
  | {
      ok: false;
      error: "entitlement_override_invalid" | "entitlement_override_not_found";
      status: 400 | 404;
    };

type EntitlementOverrideValue = {
  createdAt: Date;
  expiresAt: Date | null;
  key: string;
  revokedAt: Date | null;
  value: unknown;
};

export function resolveEntitlement(input: {
  key: EntitlementKey;
  now: Date;
  overrides: Array<{
    createdAt: Date;
    expiresAt: Date | null;
    revokedAt: Date | null;
    value: unknown;
  }>;
  planFeatures: unknown;
  subscriptionStatus: string | null;
}): EntitlementDecision {
  const subscriptionAllowsAccess =
    input.subscriptionStatus === "active" || input.subscriptionStatus === "trialing";

  if (!subscriptionAllowsAccess) {
    return {
      allowed: false,
      key: input.key,
      source: input.subscriptionStatus ? "subscription" : "missing",
      subscriptionStatus: input.subscriptionStatus,
    };
  }

  const activeOverride = input.overrides
    .filter(
      (override) =>
        !override.revokedAt &&
        (!override.expiresAt || override.expiresAt.getTime() > input.now.getTime()),
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

  if (activeOverride) {
    return {
      allowed: activeOverride.value === true,
      key: input.key,
      source: "override",
      subscriptionStatus: input.subscriptionStatus,
    };
  }

  const features = parsePlanEntitlements(input.planFeatures);

  return {
    allowed: features[input.key] === true,
    key: input.key,
    source: "plan",
    subscriptionStatus: input.subscriptionStatus,
  };
}

export function resolveEntitlements(input: {
  now: Date;
  overrides: EntitlementOverrideValue[];
  planFeatures: unknown;
  subscriptionStatus: string | null;
}): Record<EntitlementKey, EntitlementDecision> {
  return Object.fromEntries(
    ENTITLEMENT_KEYS.map((key) => [
      key,
      resolveEntitlement({
        key,
        now: input.now,
        overrides: input.overrides.filter((override) => override.key === key),
        planFeatures: input.planFeatures,
        subscriptionStatus: input.subscriptionStatus,
      }),
    ]),
  ) as Record<EntitlementKey, EntitlementDecision>;
}

export function createEntitlementService(db: PlatformDb) {
  const evaluate = async (input: {
    key: EntitlementKey;
    tenantId: string;
    now?: Date;
  }): Promise<EntitlementDecision> => {
    const [subscription] = await db
      .select({
        planFeatures: plans.features,
        subscriptionStatus: subscriptions.status,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(eq(subscriptions.tenantId, input.tenantId))
      .limit(1);

    const overrides = await db
      .select({
        createdAt: entitlementOverrides.createdAt,
        expiresAt: entitlementOverrides.expiresAt,
        revokedAt: entitlementOverrides.revokedAt,
        value: entitlementOverrides.value,
      })
      .from(entitlementOverrides)
      .where(
        and(
          eq(entitlementOverrides.tenantId, input.tenantId),
          eq(entitlementOverrides.key, input.key),
        ),
      )
      .orderBy(desc(entitlementOverrides.createdAt));

    return resolveEntitlement({
      key: input.key,
      now: input.now ?? new Date(),
      overrides,
      planFeatures: subscription?.planFeatures,
      subscriptionStatus: subscription?.subscriptionStatus ?? null,
    });
  };

  return {
    getSummary: async (input: { tenantId: string }) => {
      const entitlement = await evaluate({
        key: "customDomains",
        tenantId: input.tenantId,
      });
      const rows = await db
        .select({
          id: entitlementOverrides.id,
          value: entitlementOverrides.value,
          reason: entitlementOverrides.reason,
          expiresAt: entitlementOverrides.expiresAt,
          revokedAt: entitlementOverrides.revokedAt,
          createdAt: entitlementOverrides.createdAt,
        })
        .from(entitlementOverrides)
        .where(
          and(
            eq(entitlementOverrides.tenantId, input.tenantId),
            eq(entitlementOverrides.key, "customDomains"),
          ),
        )
        .orderBy(desc(entitlementOverrides.createdAt));
      return {
        entitlement,
        overrides: rows.map((row) => ({
          ...row,
          value: row.value === true,
          createdAt: row.createdAt.toISOString(),
          expiresAt: row.expiresAt?.toISOString() ?? null,
          revokedAt: row.revokedAt?.toISOString() ?? null,
        })),
      };
    },
    createOverride: async (input: {
      expiresAt: Date | null;
      key: EntitlementKey;
      operatorUserId: string;
      platformPrincipalId: string;
      reason: string;
      tenantId: string;
      value: boolean;
    }): Promise<EntitlementOverrideMutationResult> => {
      const reason = input.reason.trim();
      if (!reason || !input.expiresAt || input.expiresAt.getTime() <= Date.now()) {
        return { ok: false, error: "entitlement_override_invalid", status: 400 };
      }
      const expiresAt = input.expiresAt;
      const override = await db.transaction(async (transaction) => {
        const [created] = await transaction
          .insert(entitlementOverrides)
          .values({
            tenantId: input.tenantId,
            key: input.key,
            value: input.value,
            reason,
            grantedByUserId: input.operatorUserId,
            expiresAt,
          })
          .returning({ id: entitlementOverrides.id });
        if (!created) throw new Error("Entitlement override insert returned no rows.");
        await transaction.insert(auditLogs).values({
          actorUserId: input.operatorUserId,
          platformPrincipalId: input.platformPrincipalId,
          tenantId: input.tenantId,
          action: "entitlement.override_created",
          targetType: "entitlement_override",
          targetId: created.id,
          metadata: {
            expiresAt: expiresAt.toISOString(),
            key: input.key,
            reason,
            value: input.value,
          },
        });
        return created;
      });
      return { ok: true, override };
    },
    revokeOverride: async (input: {
      operatorUserId: string;
      overrideId: string;
      platformPrincipalId: string;
      reason: string;
      tenantId: string;
    }): Promise<EntitlementOverrideMutationResult> => {
      const reason = input.reason.trim();
      if (!reason) return { ok: false, error: "entitlement_override_invalid", status: 400 };
      const override = await db.transaction(async (transaction) => {
        const [revoked] = await transaction
          .update(entitlementOverrides)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(entitlementOverrides.id, input.overrideId),
              eq(entitlementOverrides.tenantId, input.tenantId),
              isNull(entitlementOverrides.revokedAt),
            ),
          )
          .returning({ id: entitlementOverrides.id });
        if (!revoked) return null;
        await transaction.insert(auditLogs).values({
          actorUserId: input.operatorUserId,
          platformPrincipalId: input.platformPrincipalId,
          tenantId: input.tenantId,
          action: "entitlement.override_revoked",
          targetType: "entitlement_override",
          targetId: revoked.id,
          metadata: { reason },
        });
        return revoked;
      });
      return override
        ? { ok: true, override }
        : { ok: false, error: "entitlement_override_not_found", status: 404 };
    },
    evaluate,
    evaluateAll: async (input: { tenantId: string; now?: Date }) => {
      const [subscription] = await db
        .select({
          planFeatures: plans.features,
          subscriptionStatus: subscriptions.status,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);
      const overrides = await db
        .select({
          createdAt: entitlementOverrides.createdAt,
          expiresAt: entitlementOverrides.expiresAt,
          key: entitlementOverrides.key,
          revokedAt: entitlementOverrides.revokedAt,
          value: entitlementOverrides.value,
        })
        .from(entitlementOverrides)
        .where(
          and(
            eq(entitlementOverrides.tenantId, input.tenantId),
            inArray(entitlementOverrides.key, ENTITLEMENT_KEYS),
          ),
        )
        .orderBy(desc(entitlementOverrides.createdAt));

      return resolveEntitlements({
        now: input.now ?? new Date(),
        overrides,
        planFeatures: subscription?.planFeatures,
        subscriptionStatus: subscription?.subscriptionStatus ?? null,
      });
    },
  };
}
