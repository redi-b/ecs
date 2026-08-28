import { type createPlatformDb, tenants } from "@ecs/db";
import type { JobHandler } from "@ecs/jobs";
import { and, eq, isNotNull } from "drizzle-orm";

import {
  createCommerceRollupWriter,
  type ListOrdersForRollup,
  runCommerceRollup,
  type WriteCommerceRollup,
} from "../../modules/analytics/commerce-rollup-service.js";
import {
  createCommerceSnapshotWriter,
  runCommerceSnapshot,
  type WriteCommerceSnapshot,
} from "../../modules/analytics/commerce-snapshot-service.js";
import type { ListProductsForExport } from "../../modules/data-transfer/product-export.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createAnalyticsCommerceRollupHandler(options: {
  db: PlatformDb;
  listTenants?: () => Promise<Array<{ salesChannelId: string | null; tenantId: string }>>;
  listOrders: ListOrdersForRollup;
  listProducts: ListProductsForExport;
  now?: () => Date;
  writeRollup?: WriteCommerceRollup;
  writeSnapshot?: WriteCommerceSnapshot;
}): JobHandler {
  const now = options.now ?? (() => new Date());
  const writeRollup = options.writeRollup ?? createCommerceRollupWriter(options.db);
  const writeSnapshot = options.writeSnapshot ?? createCommerceSnapshotWriter(options.db);
  const listTenants =
    options.listTenants ??
    (() =>
      options.db
        .select({
          salesChannelId: tenants.medusaSalesChannelId,
          tenantId: tenants.id,
        })
        .from(tenants)
        .where(and(eq(tenants.status, "active"), isNotNull(tenants.medusaSalesChannelId))));

  return async (context) => {
    const tenantRows = (await listTenants()).filter(
      (tenant) => !context?.tenantId || tenant.tenantId === context.tenantId,
    );

    const to = now();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 90);
    const results: Array<{
      error?: string;
      rowCount?: number;
      sourceOrderCount?: number;
      tenantId: string;
    }> = [];

    for (const tenant of tenantRows) {
      const salesChannelId = tenant.salesChannelId?.trim();
      if (!salesChannelId) continue;
      const result = await runCommerceRollup({
        from,
        listOrders: options.listOrders,
        salesChannelId,
        tenantId: tenant.tenantId,
        to,
        writeRollup,
      });
      const snapshot = result.ok
        ? await runCommerceSnapshot({
            listOrders: options.listOrders,
            listProducts: options.listProducts,
            observedAt: to,
            salesChannelId,
            tenantId: tenant.tenantId,
            writeSnapshot,
          })
        : null;
      if (!result.ok) {
        results.push({ error: result.error, tenantId: tenant.tenantId });
      } else if (!snapshot?.ok) {
        results.push({
          error: snapshot?.error ?? "commerce_snapshot_failed",
          tenantId: tenant.tenantId,
        });
      } else {
        results.push({
          rowCount: result.rowCount + snapshot.rowCount,
          sourceOrderCount: result.sourceOrderCount,
          tenantId: tenant.tenantId,
        });
      }
    }

    const failures = results.filter((result) => result.error);
    if (failures.length) {
      throw new Error(
        `analytics_commerce_rollup_failed:${failures.map((failure) => `${failure.tenantId}:${failure.error}`).join(",")}`,
      );
    }

    return {
      ok: true,
      tenants: results.length,
      rows: results.reduce((total, result) => total + (result.rowCount ?? 0), 0),
      sourceOrders: results.reduce((total, result) => total + (result.sourceOrderCount ?? 0), 0),
      watermark: to.toISOString(),
    };
  };
}
