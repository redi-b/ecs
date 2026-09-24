import type { MerchantOrder } from "../../types/merchant-order.js";
import { reportingDay } from "./reporting-calendar.js";

export type ProductSalesRow = {
  date: string;
  productId: string;
  variantId: string;
  productTitle: string | null;
  variantTitle: string | null;
  thumbnail: string | null;
  units: number;
  paidUnits: number;
  orders: number;
};

/** Quantity contribution, deliberately separate from order totals (tax/shipping/refunds). */
export function computeProductSalesRollup(orders: MerchantOrder[]) {
  const latestOrders = new Map<string, MerchantOrder>();
  for (const order of orders) {
    const previous = latestOrders.get(order.id);
    if (
      !previous ||
      Date.parse(order.updatedAt ?? order.createdAt ?? "") >=
        Date.parse(previous.updatedAt ?? previous.createdAt ?? "")
    )
      latestOrders.set(order.id, order);
  }
  const buckets = new Map<
    string,
    ProductSalesRow & { orderIds: Set<string>; identityAt: number }
  >();
  let unassignedUnits = 0;
  const missingItemOrders = new Set<string>();
  for (const order of latestOrders.values()) {
    if (order.status?.toLowerCase() === "canceled") continue;
    const created = new Date(order.createdAt ?? "");
    if (!Number.isFinite(created.getTime())) continue;
    if (!order.items?.length) {
      missingItemOrders.add(order.id);
      continue;
    }
    const date = reportingDay(created);
    const seen = new Set<string>();
    for (const item of order.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      if (item.quantity === null || !Number.isFinite(item.quantity) || item.quantity < 0) {
        missingItemOrders.add(order.id);
        continue;
      }
      if (!item.productId) {
        unassignedUnits += item.quantity;
        continue;
      }
      const variantId = item.variantId ?? "";
      const key = JSON.stringify([date, item.productId, variantId]);
      const bucket = buckets.get(key) ?? {
        date,
        productId: item.productId,
        variantId,
        productTitle: null,
        variantTitle: null,
        thumbnail: null,
        units: 0,
        paidUnits: 0,
        orders: 0,
        orderIds: new Set<string>(),
        identityAt: -Infinity,
      };
      if (created.getTime() >= bucket.identityAt) {
        bucket.productTitle = item.productTitle ?? item.title;
        bucket.variantTitle = item.variantTitle ?? null;
        bucket.thumbnail = item.thumbnail;
        bucket.identityAt = created.getTime();
      }
      bucket.units += item.quantity;
      if (["paid", "captured"].includes(order.paymentStatus?.toLowerCase() ?? ""))
        bucket.paidUnits += item.quantity;
      bucket.orderIds.add(order.id);
      buckets.set(key, bucket);
    }
  }
  const rows: ProductSalesRow[] = [...buckets.values()].map(
    ({ orderIds, identityAt: _identityAt, ...row }) => ({ ...row, orders: orderIds.size }),
  );
  return { rows, unassignedUnits, missingItemOrders: missingItemOrders.size };
}
