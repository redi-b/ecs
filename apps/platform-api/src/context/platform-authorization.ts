import type { createPlatformDb } from "@ecs/db";
import { platformPermissionGrants, platformPrincipals } from "@ecs/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export const PLATFORM_PERMISSIONS = [
  "billing.entitlements.read",
  "billing.entitlements.update",
  "billing.invoices.read",
  "billing.invoices.update",
  "billing.plans.read",
  "billing.plans.update",
  "billing.subscriptions.update",
  "platform.audit.read",
  "platform.health.read",
  "platform.operators.read",
  "payments.onboarding.review",
  "payments.onboarding.read",
  "platform.overview.read",
  "platform.work.read",
  "platform.work.retry",
  "tenants.status.update",
  "tenants.read",
  "tenants.operations.read",
  "tenants.diagnostics.read",
  "tenants.support.read",
  "tenants.support.note.create",
  "tenants.support.access.read",
  "tenants.support.access.manage",
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export type PlatformAuthorizationResult =
  | { ok: true; principal: { id: string; userId: string }; permission: PlatformPermission }
  | { ok: false };

export type PlatformPrincipalAccess = {
  principal: { id: string; userId: string };
  permissions: PlatformPermission[];
};

export function createPlatformPrincipalAccessLookup(db: PlatformDb) {
  return async (userId: string): Promise<PlatformPrincipalAccess | null> => {
    const rows = await db
      .select({
        principalId: platformPrincipals.id,
        userId: platformPrincipals.userId,
        permission: platformPermissionGrants.permission,
      })
      .from(platformPrincipals)
      .leftJoin(
        platformPermissionGrants,
        and(
          eq(platformPermissionGrants.principalId, platformPrincipals.id),
          isNull(platformPermissionGrants.revokedAt),
          or(
            isNull(platformPermissionGrants.expiresAt),
            gt(platformPermissionGrants.expiresAt, new Date()),
          ),
        ),
      )
      .where(and(eq(platformPrincipals.userId, userId), eq(platformPrincipals.status, "active")));
    const first = rows[0];
    if (!first) return null;
    return {
      principal: { id: first.principalId, userId: first.userId },
      permissions: rows.flatMap((row) =>
        isPlatformPermission(row.permission) ? [row.permission] : [],
      ),
    };
  };
}

export function createPlatformPermissionAuthorization(db: PlatformDb) {
  return async (input: {
    permission: PlatformPermission;
    userId: string;
  }): Promise<PlatformAuthorizationResult> => {
    const [grant] = await db
      .select({ principalId: platformPrincipals.id, userId: platformPrincipals.userId })
      .from(platformPrincipals)
      .innerJoin(
        platformPermissionGrants,
        eq(platformPermissionGrants.principalId, platformPrincipals.id),
      )
      .where(
        and(
          eq(platformPrincipals.userId, input.userId),
          eq(platformPrincipals.status, "active"),
          eq(platformPermissionGrants.permission, input.permission),
          isNull(platformPermissionGrants.revokedAt),
          or(
            isNull(platformPermissionGrants.expiresAt),
            gt(platformPermissionGrants.expiresAt, new Date()),
          ),
        ),
      )
      .limit(1);
    return grant
      ? {
          ok: true,
          principal: { id: grant.principalId, userId: grant.userId },
          permission: input.permission,
        }
      : { ok: false };
  };
}

function isPlatformPermission(value: string | null): value is PlatformPermission {
  return value !== null && (PLATFORM_PERMISSIONS as readonly string[]).includes(value);
}
