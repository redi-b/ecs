import type { createPlatformDb } from "@ecs/db";
import { auditLogs, tenants } from "@ecs/db";
import { eq } from "drizzle-orm";

import type { TenantStatus, TenantStatusUpdateResult } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const allowedOperatorStatuses = new Set<TenantStatus>(["active", "suspended"]);

function normalizeTenantStatus(value: string) {
  return value.trim().toLowerCase();
}

export function createTenantStatusService(db: PlatformDb) {
  return {
    updateTenantStatus: async (input: {
      operatorUserId: string;
      reason?: string | null | undefined;
      status: string;
      tenantId: string;
    }): Promise<TenantStatusUpdateResult> => {
      const status = normalizeTenantStatus(input.status);

      if (!allowedOperatorStatuses.has(status as TenantStatus)) {
        return {
          ok: false,
          error: "tenant_status_invalid",
          status: 400,
        };
      }

      const tenant = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(tenants)
          .set({
            status: status as TenantStatus,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, input.tenantId))
          .returning({
            id: tenants.id,
            name: tenants.name,
            handle: tenants.handle,
            status: tenants.status,
          });

        if (!row) {
          return null;
        }

        await transaction.insert(auditLogs).values({
          actorUserId: input.operatorUserId,
          tenantId: input.tenantId,
          action: "tenant.status_changed",
          targetType: "tenant",
          targetId: row.id,
          metadata: {
            reason: input.reason ?? null,
            status: row.status,
          },
        });

        return row;
      });

      if (!tenant) {
        return {
          ok: false,
          error: "tenant_not_found",
          status: 404,
        };
      }

      return {
        ok: true,
        tenant,
      };
    },
  };
}
