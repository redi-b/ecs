import { formatPublicOrderReference, type MerchantOrder } from "@ecs/contracts";

const CSV_SCHEMA_VERSION = "ecs-orders-v1";
const EXPORT_PAGE_SIZE = 100;
export const MAX_ORDER_EXPORT_COUNT = 10_000;

type OrderPageResult =
  | { ok: true; orders: MerchantOrder[]; count: number; limit: number; offset: number }
  | { ok: false; error: string; status: number };

export type ListOrdersForExport = (input: {
  limit: number;
  offset: number;
  salesChannelId: string;
}) => Promise<OrderPageResult>;

export type OrderExportResult =
  | { ok: true; csv: string; orderCount: number; rowCount: number; schemaVersion: string }
  | { ok: false; error: string; status: number };

const HEADERS = [
  "order_reference",
  "status",
  "payment_status",
  "fulfillment_status",
  "checkout_method",
  "settlement_method",
  "currency_code",
  "subtotal",
  "shipping_total",
  "discount_total",
  "total",
  "item_count",
  "delivery_choice",
  "created_at",
  "updated_at",
] as const;

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildOrderCsv(orders: MerchantOrder[]) {
  const rows = orders.map((order): unknown[] => [
    formatPublicOrderReference(order.id, order.customDisplayId),
    order.status ?? "",
    order.paymentStatus ?? "",
    order.fulfillmentStatus ?? "",
    order.paymentMethod ?? "",
    order.settlement?.method ?? "",
    order.currencyCode ?? "",
    order.subtotal ?? "",
    order.shippingTotal ?? "",
    order.discountTotal ?? "",
    order.total ?? "",
    order.itemCount ?? order.items?.reduce((total, item) => total + (item.quantity ?? 0), 0) ?? "",
    order.delivery?.choice ?? "",
    order.createdAt ?? "",
    order.updatedAt ?? "",
  ]);

  return {
    csv: `\uFEFF${[HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`,
    rowCount: rows.length,
  };
}

export async function exportOrdersToCsv(input: {
  listOrders: ListOrdersForExport;
  salesChannelId: string;
}): Promise<OrderExportResult> {
  const orders: MerchantOrder[] = [];
  let offset = 0;
  let expectedCount: number | null = null;

  do {
    const page = await input.listOrders({
      limit: EXPORT_PAGE_SIZE,
      offset,
      salesChannelId: input.salesChannelId,
    });
    if (!page.ok) return page;
    expectedCount ??= page.count;
    if (expectedCount > MAX_ORDER_EXPORT_COUNT) {
      return { ok: false, error: "order_export_too_large", status: 413 };
    }
    orders.push(...page.orders);
    offset += page.orders.length;
    if (page.orders.length === 0) break;
  } while (offset < (expectedCount ?? 0));

  const uniqueOrders = [...new Map(orders.map((order) => [order.id, order])).values()];
  const built = buildOrderCsv(uniqueOrders);
  return {
    ok: true,
    csv: built.csv,
    orderCount: uniqueOrders.length,
    rowCount: built.rowCount,
    schemaVersion: CSV_SCHEMA_VERSION,
  };
}

export function orderExportFilename(date = new Date()) {
  return `ecs-orders-${date.toISOString().replaceAll(/[-:]/g, "").slice(0, 15)}Z.csv`;
}
