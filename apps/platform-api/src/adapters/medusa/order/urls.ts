import type { MerchantOrderListQuery } from "../../../types/index.js";
import { resolveCreatedRange } from "./list-query.js";

const LIST_FIELDS = [
  "id",
  "display_id",
  "email",
  "customer_id",
  "status",
  "payment_status",
  "fulfillment_status",
  "currency_code",
  "total",
  "subtotal",
  "shipping_total",
  "discount_total",
  "sales_channel_id",
  "metadata",
  "*shipping_address",
  // Line items for list column + Telegram order cards (include variant when available).
  "*items",
  "*items.variant",
  "*items.variant.options",
  "*items.product",
  "created_at",
  "updated_at",
].join(",");

const DETAIL_FIELDS = [
  "id",
  "display_id",
  "email",
  "customer_id",
  "status",
  "payment_status",
  "fulfillment_status",
  "currency_code",
  "total",
  "subtotal",
  "shipping_total",
  "discount_total",
  "sales_channel_id",
  "metadata",
  "*shipping_address",
  "*billing_address",
  "*fulfillments",
  "*items",
  "*items.detail",
  "*items.variant",
  "*items.variant.options",
  "*items.variant.options.option",
  "*items.product",
  "*payment_collections",
  "*payment_collections.payment_sessions",
  "created_at",
  "updated_at",
].join(",");

export function getOrdersUrl(medusaInternalUrl: string, input: MerchantOrderListQuery) {
  const url = new URL("/admin/orders", normalizeBaseUrl(medusaInternalUrl));

  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("offset", String(input.offset));
  url.searchParams.set("order", "-created_at");
  url.searchParams.set("fields", LIST_FIELDS);

  // Tenant isolation at query time (post-filter remains as belt-and-suspenders).
  url.searchParams.append("sales_channel_id[]", input.salesChannelId);

  if (input.q?.trim()) {
    url.searchParams.set("q", input.q.trim());
  }

  applyPaymentStatusFilter(url, input.paymentStatus);
  applyProgressFilter(url, input.progress);

  const range = resolveCreatedRange(input);
  if (range.createdFrom) {
    url.searchParams.set("created_at[$gte]", range.createdFrom);
  }
  if (range.createdTo) {
    url.searchParams.set("created_at[$lte]", range.createdTo);
  }

  return url;
}

function applyPaymentStatusFilter(
  url: URL,
  paymentStatus: MerchantOrderListQuery["paymentStatus"],
) {
  if (!paymentStatus) return;

  if (paymentStatus === "paid") {
    for (const status of ["captured", "paid", "partially_refunded", "refunded"]) {
      url.searchParams.append("payment_status[]", status);
    }
    return;
  }

  if (paymentStatus === "failed") {
    for (const status of ["canceled", "cancelled"]) {
      url.searchParams.append("payment_status[]", status);
    }
    return;
  }

  // unpaid
  for (const status of ["not_paid", "awaiting", "authorized", "requires_action", "pending"]) {
    url.searchParams.append("payment_status[]", status);
  }
}

function applyProgressFilter(url: URL, progress: MerchantOrderListQuery["progress"]) {
  if (!progress) return;

  if (progress === "canceled") {
    url.searchParams.append("status[]", "canceled");
    url.searchParams.append("status[]", "cancelled");
    return;
  }

  if (progress === "completed") {
    url.searchParams.append("status[]", "completed");
    url.searchParams.append("fulfillment_status[]", "delivered");
    return;
  }

  if (progress === "open") {
    // Prefer excluding terminal statuses via positive statuses when Medusa allows.
    for (const status of ["pending", "requires_action", "not_fulfilled"]) {
      url.searchParams.append("status[]", status);
    }
    return;
  }

  if (progress === "ready") {
    for (const status of ["fulfilled", "shipped", "partially_fulfilled", "partially_shipped"]) {
      url.searchParams.append("fulfillment_status[]", status);
    }
    return;
  }

  // new
  for (const status of ["not_fulfilled", "partially_fulfilled"]) {
    url.searchParams.append("fulfillment_status[]", status);
  }
}

export function getOrderUrl(
  medusaInternalUrl: string,
  input: { orderId: string; salesChannelId: string },
) {
  const url = new URL(
    `/admin/orders/${encodeURIComponent(input.orderId)}`,
    normalizeBaseUrl(medusaInternalUrl),
  );

  url.searchParams.set("fields", DETAIL_FIELDS);

  return url;
}

export function getOrderFulfillmentUrl(medusaInternalUrl: string, input: { orderId: string }) {
  return new URL(
    `/admin/orders/${encodeURIComponent(input.orderId)}/fulfillments`,
    normalizeBaseUrl(medusaInternalUrl),
  );
}

export function getOrderFulfillmentDeliveryUrl(
  medusaInternalUrl: string,
  input: { fulfillmentId: string; orderId: string },
) {
  return new URL(
    `/admin/orders/${encodeURIComponent(input.orderId)}/fulfillments/${encodeURIComponent(
      input.fulfillmentId,
    )}/mark-as-delivered`,
    normalizeBaseUrl(medusaInternalUrl),
  );
}

export function getOrderActionUrl(
  medusaInternalUrl: string,
  input: { action: "cancel" | "complete"; orderId: string },
) {
  return new URL(
    `/admin/orders/${encodeURIComponent(input.orderId)}/${input.action}`,
    normalizeBaseUrl(medusaInternalUrl),
  );
}

export function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
