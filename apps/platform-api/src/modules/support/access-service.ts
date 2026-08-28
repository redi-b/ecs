import type { createPlatformDb } from "@ecs/db";
import { auditLogs, tenantSupportAccessGrants } from "@ecs/db";
import { and, desc, eq, isNull } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const MAX_SUPPORT_ACCESS_MS = 8 * 60 * 60 * 1_000;
const MIN_SUPPORT_ACCESS_MS = 15 * 60 * 1_000;

function serializeGrant(grant: typeof tenantSupportAccessGrants.$inferSelect) {
  return {
    id: grant.id,
    operatorUserId: grant.operatorUserId,
    reason: grant.reason,
    expiresAt: grant.expiresAt.toISOString(),
    revokedAt: grant.revokedAt?.toISOString() ?? null,
    revokeReason: grant.revokeReason,
    createdAt: grant.createdAt.toISOString(),
  };
}

export function validateSupportAccessExpiry(expiresAt: Date, now = new Date()) {
  const duration = expiresAt.getTime() - now.getTime();
  return (
    Number.isFinite(duration) &&
    duration >= MIN_SUPPORT_ACCESS_MS &&
    duration <= MAX_SUPPORT_ACCESS_MS
  );
}

export function createSupportAccessService(db: PlatformDb) {
  return {
    list: async (input: { tenantId: string; limit?: number }) => {
      const grants = await db
        .select()
        .from(tenantSupportAccessGrants)
        .where(eq(tenantSupportAccessGrants.tenantId, input.tenantId))
        .orderBy(desc(tenantSupportAccessGrants.createdAt))
        .limit(Math.min(Math.max(input.limit ?? 20, 1), 100));
      return { grants: grants.map(serializeGrant) };
    },
    create: async (input: {
      expiresAt: Date;
      operatorUserId: string;
      platformPrincipalId: string;
      reason: string;
      tenantId: string;
    }) => {
      if (!validateSupportAccessExpiry(input.expiresAt) || input.reason.trim().length < 10) {
        return {
          ok: false as const,
          error: "support_access_invalid" as const,
          status: 400 as const,
        };
      }
      const grant = await db.transaction(async (transaction) => {
        const [created] = await transaction
          .insert(tenantSupportAccessGrants)
          .values({
            expiresAt: input.expiresAt,
            operatorUserId: input.operatorUserId,
            platformPrincipalId: input.platformPrincipalId,
            reason: input.reason.trim(),
            tenantId: input.tenantId,
          })
          .returning();
        if (!created) throw new Error("Support-access insert returned no row.");
        await transaction.insert(auditLogs).values({
          actorUserId: input.operatorUserId,
          platformPrincipalId: input.platformPrincipalId,
          tenantId: input.tenantId,
          action: "support.access_granted",
          targetType: "tenant_support_access_grant",
          targetId: created.id,
          metadata: { expiresAt: created.expiresAt.toISOString(), reason: created.reason },
        });
        return created;
      });
      return { ok: true as const, grant: serializeGrant(grant) };
    },
    revoke: async (input: {
      grantId: string;
      operatorUserId: string;
      platformPrincipalId: string;
      reason: string;
      tenantId: string;
    }) => {
      if (input.reason.trim().length < 10) {
        return {
          ok: false as const,
          error: "support_access_invalid" as const,
          status: 400 as const,
        };
      }
      const grant = await db.transaction(async (transaction) => {
        const [revoked] = await transaction
          .update(tenantSupportAccessGrants)
          .set({
            revokedAt: new Date(),
            revokedByUserId: input.operatorUserId,
            revokeReason: input.reason.trim(),
          })
          .where(
            and(
              eq(tenantSupportAccessGrants.id, input.grantId),
              eq(tenantSupportAccessGrants.tenantId, input.tenantId),
              isNull(tenantSupportAccessGrants.revokedAt),
            ),
          )
          .returning();
        if (!revoked) return null;
        await transaction.insert(auditLogs).values({
          actorUserId: input.operatorUserId,
          platformPrincipalId: input.platformPrincipalId,
          tenantId: input.tenantId,
          action: "support.access_revoked",
          targetType: "tenant_support_access_grant",
          targetId: revoked.id,
          metadata: { reason: input.reason.trim() },
        });
        return revoked;
      });
      return grant
        ? { ok: true as const, grant: serializeGrant(grant) }
        : { ok: false as const, error: "support_access_not_found" as const, status: 404 as const };
    },
  };
}
