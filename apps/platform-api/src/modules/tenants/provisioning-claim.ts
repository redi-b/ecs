import type { createPlatformDb } from "@ecs/db";
import { tenantProvisioningClaims } from "@ecs/db";
import { and, eq, lte, sql } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type TenantProvisioningClaim = {
  claimToken: string;
  platformTenantId: string;
};

export type TenantProvisioningClaimStore = {
  acquire: (input: {
    handle: string;
    ownerUserId: string;
    preferredPlatformTenantId: string;
  }) => Promise<TenantProvisioningClaim | null>;
  release: (input: { claimToken: string; handle: string }) => Promise<void>;
};

export async function runWithTenantProvisioningClaim<T>(
  store: TenantProvisioningClaimStore,
  input: {
    handle: string;
    ownerUserId: string;
    preferredPlatformTenantId: string;
  },
  operation: (platformTenantId: string) => Promise<T>,
): Promise<{ acquired: false } | { acquired: true; value: T }> {
  const claim = await store.acquire(input);
  if (!claim) return { acquired: false };

  try {
    return {
      acquired: true,
      value: await operation(claim.platformTenantId),
    };
  } finally {
    try {
      await store.release({
        claimToken: claim.claimToken,
        handle: input.handle,
      });
    } catch (error) {
      console.error("Tenant provisioning claim release failed", error);
    }
  }
}

export function createTenantProvisioningClaimStore(
  db: PlatformDb,
  options: {
    leaseDurationMs?: number;
  } = {},
): TenantProvisioningClaimStore {
  const leaseDurationMs = options.leaseDurationMs ?? 10 * 60 * 1000;
  return {
    acquire: async (input) => {
      const claimToken = crypto.randomUUID();
      const databaseNow = sql<Date>`now()`;
      const leaseExpiresAt = sql<Date>`now() + (${leaseDurationMs} * interval '1 millisecond')`;

      const [claim] = await db
        .insert(tenantProvisioningClaims)
        .values({
          claimToken,
          handle: input.handle,
          leaseExpiresAt,
          ownerUserId: input.ownerUserId,
          platformTenantId: input.preferredPlatformTenantId,
          updatedAt: databaseNow,
        })
        .onConflictDoUpdate({
          target: tenantProvisioningClaims.handle,
          set: {
            claimToken,
            leaseExpiresAt,
            ownerUserId: input.ownerUserId,
            updatedAt: databaseNow,
          },
          setWhere: lte(tenantProvisioningClaims.leaseExpiresAt, databaseNow),
        })
        .returning({
          claimToken: tenantProvisioningClaims.claimToken,
          platformTenantId: tenantProvisioningClaims.platformTenantId,
        });

      return claim ?? null;
    },
    release: async (input) => {
      await db
        .delete(tenantProvisioningClaims)
        .where(
          and(
            eq(tenantProvisioningClaims.handle, input.handle),
            eq(tenantProvisioningClaims.claimToken, input.claimToken),
          ),
        );
    },
  };
}
