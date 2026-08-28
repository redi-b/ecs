import type { createPlatformDb } from "@ecs/db";
import { auditLogs, tenantProvisioningAttempts } from "@ecs/db";
import { and, eq, isNull } from "drizzle-orm";

import type { TenantShopProvisioningResult } from "../../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createSuperadminWorkRecoveryService(options: {
  createTenantShop: (input: {
    handle: string;
    name: string;
    ownerUserId: string;
    platformTenantId: string;
    templateId?: string;
    templateKey?: string;
  }) => Promise<TenantShopProvisioningResult>;
  db: PlatformDb;
}) {
  return async (input: {
    attemptId: string;
    operatorUserId: string;
    platformPrincipalId: string;
    reason: string;
  }) => {
    const reason = input.reason.trim();
    if (reason.length < 10) {
      return {
        ok: false as const,
        error: "recovery_reason_required" as const,
        status: 400 as const,
      };
    }
    const correlationId = crypto.randomUUID();
    const claimed = await options.db.transaction(async (transaction) => {
      const [row] = await transaction
        .update(tenantProvisioningAttempts)
        .set({ status: "retrying" })
        .where(
          and(
            eq(tenantProvisioningAttempts.id, input.attemptId),
            eq(tenantProvisioningAttempts.status, "failed"),
            isNull(tenantProvisioningAttempts.tenantId),
          ),
        )
        .returning({
          id: tenantProvisioningAttempts.id,
          handle: tenantProvisioningAttempts.handle,
          metadata: tenantProvisioningAttempts.metadata,
          ownerUserId: tenantProvisioningAttempts.ownerUserId,
          platformTenantId: tenantProvisioningAttempts.platformTenantId,
        });
      if (!row) return null;
      await transaction.insert(auditLogs).values({
        correlationId,
        outcome: "accepted",
        actorUserId: input.operatorUserId,
        platformPrincipalId: input.platformPrincipalId,
        tenantId: row.platformTenantId,
        action: "provisioning.recovery_requested",
        targetType: "tenant_provisioning_attempt",
        targetId: input.attemptId,
        metadata: { reason },
      });
      return row;
    });
    if (!claimed) {
      return { ok: false as const, error: "recovery_not_available" as const, status: 409 as const };
    }

    let result: TenantShopProvisioningResult;
    try {
      result = await options.createTenantShop({
        handle: claimed.handle,
        name: getAttemptName(claimed.metadata, claimed.handle),
        ownerUserId: claimed.ownerUserId,
        platformTenantId: claimed.platformTenantId,
        ...getTemplateSelection(claimed.metadata),
      });
    } catch {
      await recordResult(options.db, {
        ...input,
        platformTenantId: claimed.platformTenantId,
        correlationId,
        reason,
        status: "failed",
      });
      return { ok: false as const, error: "recovery_failed" as const, status: 503 as const };
    }

    await recordResult(options.db, {
      ...input,
      platformTenantId: claimed.platformTenantId,
      correlationId,
      reason,
      status: result.ok ? "retried" : "failed",
    });
    return result.ok
      ? { ok: true as const, tenant: result.tenant }
      : { ok: false as const, error: "recovery_failed" as const, status: result.status };
  };
}

async function recordResult(
  db: PlatformDb,
  input: {
    attemptId: string;
    operatorUserId: string;
    platformPrincipalId: string;
    platformTenantId: string;
    correlationId: string;
    reason: string;
    status: "failed" | "retried";
  },
) {
  await db.transaction(async (transaction) => {
    await transaction
      .update(tenantProvisioningAttempts)
      .set({
        status: input.status,
        ...(input.status === "retried" ? { completedAt: new Date() } : {}),
      })
      .where(eq(tenantProvisioningAttempts.id, input.attemptId));
    await transaction.insert(auditLogs).values({
      correlationId: input.correlationId,
      outcome: input.status === "retried" ? "completed" : "failed",
      actorUserId: input.operatorUserId,
      platformPrincipalId: input.platformPrincipalId,
      tenantId: input.platformTenantId,
      action:
        input.status === "retried"
          ? "provisioning.recovery_completed"
          : "provisioning.recovery_failed",
      targetType: "tenant_provisioning_attempt",
      targetId: input.attemptId,
      metadata: { reason: input.reason },
    });
  });
}

function getAttemptName(metadata: unknown, handle: string) {
  if (metadata && typeof metadata === "object" && "name" in metadata) {
    const name = Reflect.get(metadata, "name");
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return handle;
}

function getTemplateSelection(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return {};
  const templateId = Reflect.get(metadata, "templateId");
  const templateKey = Reflect.get(metadata, "templateKey");
  return {
    ...(typeof templateId === "string" && templateId.trim() ? { templateId } : {}),
    ...(typeof templateKey === "string" && templateKey.trim() ? { templateKey } : {}),
  };
}
