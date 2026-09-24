import type { createPlatformDb } from "@ecs/db";
import { dailyMetrics } from "@ecs/db";
import { and, eq, inArray } from "drizzle-orm";

import type { MerchantOrder, MerchantOrdersResult } from "../../types/index.js";
import type { MerchantOrderListQuery } from "../../types/merchant-order.js";
import type { ListProductsForExport } from "../data-transfer/product-export.js";
import { COMMERCE_ROLLUP_VERSION, DEFAULT_REPORTING_TIMEZONE } from "./commerce-rollup.js";
import {
  type CommerceSnapshotMetricKey,
  type CommerceSnapshotProduct,
  type CommerceSnapshotRow,
  computeCommerceSnapshot,
} from "./commerce-snapshot.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
const PAGE_SIZE = 100;
export const MAX_COMMERCE_SNAPSHOT_RECORDS = 10_000;
const snapshotMetricKeys: CommerceSnapshotMetricKey[] = [
  "overview.products",
  "overview.attention.draft_products",
  "overview.attention.unfulfilled",
  "overview.attention.unpaid",
  "overview.order_status",
  "overview.payment_status",
  "overview.fulfillment_status",
];

export type WriteCommerceSnapshot = (input: {
  observedAt: Date;
  rows: CommerceSnapshotRow[];
  tenantId: string;
  timezone: string;
}) => Promise<void>;

export async function runCommerceSnapshot(input: {
  listOrders: (input: MerchantOrderListQuery) => Promise<MerchantOrdersResult>;
  listProducts: ListProductsForExport;
  observedAt: Date;
  salesChannelId: string;
  tenantId: string;
  timezone?: string | undefined;
  writeSnapshot: WriteCommerceSnapshot;
}) {
  const timezone = input.timezone?.trim() || DEFAULT_REPORTING_TIMEZONE;
  const [ordersResult, productsResult] = await Promise.all([
    loadAllOrders(input.listOrders, input.salesChannelId),
    loadAllProducts(input.listProducts, input.salesChannelId),
  ]);
  if (!ordersResult.ok) return ordersResult;
  if (!productsResult.ok) return productsResult;
  const rows = computeCommerceSnapshot({
    date: localDate(input.observedAt, timezone),
    orders: ordersResult.orders,
    products: productsResult.products,
  });
  await input.writeSnapshot({
    observedAt: input.observedAt,
    rows,
    tenantId: input.tenantId,
    timezone,
  });
  return {
    ok: true as const,
    orderCount: ordersResult.orders.length,
    productCount: productsResult.products.length,
    rowCount: rows.length,
  };
}

export function createCommerceSnapshotWriter(db: PlatformDb): WriteCommerceSnapshot {
  return async (input) => {
    await db.transaction(async (transaction) => {
      await transaction
        .delete(dailyMetrics)
        .where(
          and(
            eq(dailyMetrics.tenantId, input.tenantId),
            inArray(dailyMetrics.metricKey, snapshotMetricKeys),
            eq(dailyMetrics.rollupVersion, COMMERCE_ROLLUP_VERSION),
          ),
        );
      await transaction.insert(dailyMetrics).values(
        input.rows.map((row) => ({
          ...row,
          computedAt: input.observedAt,
          rollupVersion: COMMERCE_ROLLUP_VERSION,
          sourceWindowEnd: input.observedAt,
          tenantId: input.tenantId,
          timezone: input.timezone,
          value: String(row.value),
        })),
      );
    });
  };
}

async function loadAllOrders(
  listOrders: (input: MerchantOrderListQuery) => Promise<MerchantOrdersResult>,
  salesChannelId: string,
) {
  const orders: MerchantOrder[] = [];
  let offset = 0;
  let count: number | null = null;
  do {
    const page = await listOrders({ limit: PAGE_SIZE, offset, salesChannelId });
    if (!page.ok) return page;
    count ??= page.count;
    if (count > MAX_COMMERCE_SNAPSHOT_RECORDS) {
      return { ok: false as const, error: "commerce_snapshot_orders_too_large", status: 413 };
    }
    orders.push(...page.orders);
    offset += page.orders.length;
    if (!page.orders.length) break;
  } while (offset < (count ?? 0));
  return { ok: true as const, orders };
}

async function loadAllProducts(listProducts: ListProductsForExport, salesChannelId: string) {
  const products: CommerceSnapshotProduct[] = [];
  let offset = 0;
  let count: number | null = null;
  do {
    const page = await listProducts({ limit: PAGE_SIZE, offset, salesChannelId });
    if (!page.ok) return page;
    count ??= page.count;
    if (count > MAX_COMMERCE_SNAPSHOT_RECORDS) {
      return { ok: false as const, error: "commerce_snapshot_products_too_large", status: 413 };
    }
    products.push(...page.products.map(({ id, status }) => ({ id, status })));
    offset += page.products.length;
    if (!page.products.length) break;
  } while (offset < (count ?? 0));
  return { ok: true as const, products };
}

function localDate(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(value);
}
