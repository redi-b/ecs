import { parseProfileAvatar } from "@ecs/contracts";
import type { createPlatformDb } from "@ecs/db";
import {
  organizationMembers,
  platformPrincipals,
  tenantSupportAccessGrants,
  tenants,
  users,
} from "@ecs/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  builtInMerchantRoleAllows,
  createMerchantPermissionLookup,
} from "../auth/merchant-authorization.js";
import type { MerchantPermissionRequest } from "../auth/merchant-permissions.js";
import type { DashboardAuthorizationResult } from "../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createDashboardAuthorizationLookup(db: PlatformDb) {
  const hasMerchantPermission = createMerchantPermissionLookup(db);

  return async function authorizeDashboardForTenant(input: {
    tenantId: string;
    userId: string;
    permission?: MerchantPermissionRequest;
  }): Promise<DashboardAuthorizationResult> {
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarPreferences: users.avatarPreferences,
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(tenants, eq(organizationMembers.organizationId, tenants.organizationId))
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(
        and(
          eq(tenants.id, input.tenantId),
          eq(organizationMembers.status, "active"),
          eq(users.id, input.userId),
          eq(users.status, "active"),
        ),
      )
      .limit(1);

    if (!row) {
      const [support] = await db
        .select({
          grantId: tenantSupportAccessGrants.id,
          expiresAt: tenantSupportAccessGrants.expiresAt,
          id: users.id,
          email: users.email,
          name: users.name,
          avatarPreferences: users.avatarPreferences,
        })
        .from(tenantSupportAccessGrants)
        .innerJoin(
          platformPrincipals,
          eq(tenantSupportAccessGrants.platformPrincipalId, platformPrincipals.id),
        )
        .innerJoin(users, eq(tenantSupportAccessGrants.operatorUserId, users.id))
        .where(
          and(
            eq(tenantSupportAccessGrants.tenantId, input.tenantId),
            eq(tenantSupportAccessGrants.operatorUserId, input.userId),
            eq(platformPrincipals.userId, input.userId),
            eq(platformPrincipals.status, "active"),
            eq(users.status, "active"),
            isNull(tenantSupportAccessGrants.revokedAt),
            gt(tenantSupportAccessGrants.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (!support) return { ok: false };
      if (input.permission && !builtInMerchantRoleAllows("staff", input.permission)) {
        return { ok: false };
      }
      return {
        ok: true,
        actor: {
          id: support.id,
          email: support.email,
          name: support.name,
          avatar: parseProfileAvatar(support.avatarPreferences),
          role: "operator" as const,
          supportAccess: {
            grantId: support.grantId,
            expiresAt: support.expiresAt.toISOString(),
          },
        },
      };
    }

    if (
      input.permission &&
      !(await hasMerchantPermission({
        organizationId: row.organizationId,
        role: row.role,
        permission: input.permission,
      }))
    ) {
      return { ok: false };
    }

    return {
      ok: true,
      actor: {
        id: row.id,
        email: row.email,
        name: row.name,
        avatar: parseProfileAvatar(row.avatarPreferences),
        role: row.role,
      },
    };
  };
}
