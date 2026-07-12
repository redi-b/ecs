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
    // Include shipping name/phone so list rows can show a real customer without raw emails only.
    "id,display_id,email,status,payment_status,fulfillment_status,currency_code,total,sales_channel_id,metadata,shipping_address.first_name,shipping_address.last_name,shipping_address.phone,created_at,updated_at",
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
    "id,display_id,email,status,payment_status,fulfillment_status,currency_code,total,sales_channel_id,metadata,shipping_address.first_name,shipping_address.last_name,shipping_address.phone,shipping_address.address_1,shipping_address.address_2,shipping_address.city,shipping_address.province,shipping_address.postal_code,shipping_address.country_code,shipping_address.metadata,fulfillments.id,fulfillments.delivered_at,fulfillments.shipped_at,fulfillments.canceled_at,items.id,items.product_id,items.variant_id,items.title,items.quantity,items.detail.fulfilled_quantity,items.unit_price,items.total,items.thumbnail,created_at,updated_at",
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
