import type { MerchantOrderAction } from "../../../types/index.js";

export function getOrdersUrl(
  medusaInternalUrl: string,
  input: { limit: number; offset: number; salesChannelId: string },
) {
  const url = new URL("/admin/orders", normalizeBaseUrl(medusaInternalUrl));

  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("offset", String(input.offset));
  url.searchParams.set("order", "-created_at");
  url.searchParams.set(
    "fields",
    // Star expansions are required — granular `items.quantity` fields are silently dropped by Medusa.
    "id,display_id,email,status,payment_status,fulfillment_status,currency_code,total,sales_channel_id,metadata,*shipping_address,created_at,updated_at",
  );

  return url;
}

export function getOrderUrl(
  medusaInternalUrl: string,
  input: { orderId: string; salesChannelId: string },
) {
  const url = new URL(
    `/admin/orders/${encodeURIComponent(input.orderId)}`,
    normalizeBaseUrl(medusaInternalUrl),
  );

  url.searchParams.set(
    "fields",
    // Use *relations — requesting items.quantity alone returns title/unit_price but drops qty/total.
    [
      "id",
      "display_id",
      "email",
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
      "created_at",
      "updated_at",
    ].join(","),
  );

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
  input: { action: MerchantOrderAction; orderId: string },
) {
  return new URL(
    `/admin/orders/${encodeURIComponent(input.orderId)}/${input.action}`,
    normalizeBaseUrl(medusaInternalUrl),
  );
}

export function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
