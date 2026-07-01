import type { createPlatformDb } from "@ecs/db";
import { tenantMemberships, tenants, users } from "@ecs/db";
import { and, eq } from "drizzle-orm";

import type { TenantCommerceContextResult } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createTenantCommerceContextService(db: PlatformDb) {
  return async function getTenantCommerceContext(input: {
    tenantId: string;
    userId: string;
  }): Promise<TenantCommerceContextResult> {
    const [row] = await db
      .select({
        id: tenants.id,
        medusaStoreId: tenants.medusaStoreId,
        medusaSalesChannelId: tenants.medusaSalesChannelId,
        medusaPublishableKeyId: tenants.medusaPublishableKeyId,
        medusaRegionId: tenants.medusaRegionId,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(
        and(
          eq(tenants.id, input.tenantId),
          eq(tenantMemberships.userId, input.userId),
          eq(tenantMemberships.status, "active"),
          eq(users.status, "active"),
        ),
      )
      .limit(1);

    if (!row) {
      return {
        ok: false,
        error: "tenant_not_found",
        status: 404,
      };
    }

    if (!row.medusaSalesChannelId) {
      return {
        ok: false,
        error: "commerce_sales_channel_unavailable",
        status: 503,
      };
    }

    return {
      ok: true,
      context: {
        tenantId: row.id,
        medusaStoreId: row.medusaStoreId,
        medusaSalesChannelId: row.medusaSalesChannelId,
        medusaPublishableKeyId: row.medusaPublishableKeyId,
        medusaRegionId: row.medusaRegionId,
      },
    };
  };
}
