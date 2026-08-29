import type { createPlatformDb } from "@ecs/db";
import { plans, planVersions, subscriptions } from "@ecs/db";
import { eq, sql } from "drizzle-orm";

import type { ProductWriteInput } from "../../adapters/medusa/product/types.js";
import type { MerchantProductsResult, MerchantProductWriteResult } from "../../types/index.js";
import { createPostgresCapacityService } from "./capacity-service.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export async function resolveProductLimit(db: PlatformDb, tenantId: string) {
  const [row] = await db
    .select({
      limits: sql<unknown>`coalesce(${planVersions.limits}, ${plans.limits})`,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);
  const source =
    row?.limits && typeof row.limits === "object" && !Array.isArray(row.limits)
      ? (row.limits as Record<string, unknown>)
      : {};
  const value = source.products;
  return {
    limit: typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null,
    subscriptionStatus: row?.status ?? null,
  };
}

export function createProductCapacityWriter(input: {
  createProduct(request: ProductWriteInput): Promise<MerchantProductWriteResult>;
  db: PlatformDb;
  listProducts(request: {
    limit: number;
    offset: number;
    salesChannelId: string;
  }): Promise<MerchantProductsResult>;
  resolveTenantId(salesChannelId: string): Promise<string | null>;
}) {
  const capacity = createPostgresCapacityService(input.db);
  return async (
    request: ProductWriteInput & {
      capacityIdempotencyKey?: string;
      tenantId?: string;
    },
  ): Promise<MerchantProductWriteResult> => {
    const tenantId = request.tenantId ?? (await input.resolveTenantId(request.salesChannelId));
    if (!tenantId) return { ok: false, error: "commerce_backend_unavailable", status: 503 };
    const policy = await resolveProductLimit(input.db, tenantId);
    if (policy.limit === null) return input.createProduct(request);

    const current = await input.listProducts({
      limit: 1,
      offset: 0,
      salesChannelId: request.salesChannelId,
    });
    if (!current.ok) {
      return {
        ok: false,
        error:
          current.error === "commerce_credentials_invalid" ||
          current.error === "commerce_credentials_missing"
            ? current.error
            : "commerce_backend_unavailable",
        status:
          current.error === "commerce_credentials_invalid"
            ? 401
            : current.error === "commerce_credentials_missing"
              ? 503
              : 503,
      };
    }

    const reserved = await capacity.reserve({
      amount: 1,
      capability: "products",
      idempotencyKey: request.capacityIdempotencyKey?.trim() || crypto.randomUUID(),
      limit: policy.limit,
      observedUsage: current.count,
      subscriptionStatus: policy.subscriptionStatus,
      tenantId,
      ttlSeconds: 120,
      windowKey: "lifetime",
    });
    if (!reserved.ok || !reserved.reservation || !reserved.decision.allowed) {
      return { ok: false, error: "product_limit_reached", status: 409 };
    }

    const result = await input.createProduct(request);
    if (!result.ok) {
      await capacity.release(reserved.reservation.id);
      return result;
    }
    const committed = await capacity.commit(reserved.reservation.id);
    if (!committed.ok) {
      throw new Error(`product_capacity_commit_failed:${reserved.reservation.id}`);
    }
    return result;
  };
}
