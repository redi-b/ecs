import type { createPlatformDb } from "@ecs/db";
import { platformPrincipals, tenantMemberships, tenantSupportAccessGrants, users } from "@ecs/db";
import { and, eq, gt, isNull } from "drizzle-orm";

import type { DashboardAuthorizationResult } from "../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createDashboardAuthorizationLookup(db: PlatformDb) {
  return async function authorizeDashboardForTenant(input: {
    tenantId: string;
    userId: string;
  }): Promise<DashboardAuthorizationResult> {
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: tenantMemberships.role,
      })
      .from(tenantMemberships)
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(
        and(
          eq(tenantMemberships.tenantId, input.tenantId),
          eq(tenantMemberships.status, "active"),
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
      return {
        ok: true,
        actor: {
          id: support.id,
          email: support.email,
          name: support.name,
          role: "operator" as const,
          supportAccess: {
            grantId: support.grantId,
            expiresAt: support.expiresAt.toISOString(),
          },
        },
      };
    }

    return {
      ok: true,
      actor: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
      },
    };
  };
}
