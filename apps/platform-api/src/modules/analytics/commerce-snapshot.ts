import type { MerchantOrder } from "../../types/index.js";
import type { CommerceRollupRow } from "./commerce-rollup.js";

export type CommerceSnapshotMetricKey =
  | "overview.products"
  | "overview.attention.draft_products"
  | "overview.attention.unfulfilled"
  | "overview.attention.unpaid"
  | "overview.order_status"
  | "overview.payment_status"
  | "overview.fulfillment_status";

export type CommerceSnapshotRow = Omit<CommerceRollupRow, "metricKey"> & {
  metricKey: CommerceSnapshotMetricKey;
};

export type CommerceSnapshotProduct = {
  id: string;
  status: string | null;
};

const paidStatuses = new Set(["captured", "paid"]);
const fulfilledStatuses = new Set(["delivered", "fulfilled", "shipped"]);

export function computeCommerceSnapshot(input: {
  date: string;
  orders: MerchantOrder[];
  products: CommerceSnapshotProduct[];
}): CommerceSnapshotRow[] {
  const ordersById = latestById(input.orders);
  const productsById = new Map(input.products.map((product) => [product.id, product]));
  const activeOrders = [...ordersById.values()].filter(
    (order) => order.status?.trim().toLowerCase() !== "canceled",
  );
  const rows: CommerceSnapshotRow[] = [
    row(input.date, "overview.products", productsById.size),
    row(
      input.date,
      "overview.attention.draft_products",
      [...productsById.values()].filter(
        (product) => product.status?.trim().toLowerCase() === "draft",
      ).length,
    ),
    row(
      input.date,
      "overview.attention.unpaid",
      activeOrders.filter(
        (order) => !paidStatuses.has(order.paymentStatus?.trim().toLowerCase() ?? ""),
      ).length,
    ),
    row(
      input.date,
      "overview.attention.unfulfilled",
      activeOrders.filter(
        (order) => !fulfilledStatuses.has(order.fulfillmentStatus?.trim().toLowerCase() ?? ""),
      ).length,
    ),
  ];

  rows.push(
    ...breakdown(
      input.date,
      "overview.order_status",
      activeOrders.map((order) => order.status),
    ),
    ...breakdown(
      input.date,
      "overview.payment_status",
      activeOrders.map((order) => order.paymentStatus),
    ),
    ...breakdown(
      input.date,
      "overview.fulfillment_status",
      activeOrders.map((order) => order.fulfillmentStatus),
    ),
  );
  return rows;
}

function latestById(orders: MerchantOrder[]) {
  const result = new Map<string, MerchantOrder>();
  for (const order of orders) {
    const current = result.get(order.id);
    if (!current || timestamp(order.updatedAt) >= timestamp(current.updatedAt)) {
      result.set(order.id, order);
    }
  }
  return result;
}

function breakdown(
  date: string,
  metricKey: Extract<CommerceSnapshotMetricKey, `${string}_status`>,
  values: Array<string | null>,
) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value?.trim().toLowerCase() || "unknown";
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dimensionValue, value]) => row(date, metricKey, value, "status", dimensionValue));
}

function row(
  date: string,
  metricKey: CommerceSnapshotMetricKey,
  value: number,
  dimensionKey = "",
  dimensionValue = "",
): CommerceSnapshotRow {
  return { currencyCode: "", date, dimensionKey, dimensionValue, metricKey, value };
}

function timestamp(value: string | null | undefined) {
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
