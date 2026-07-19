import type { MerchantOrder } from "../../types/index.js";
import { buildOrderItemLines, formatOrderLineItemLabel } from "./telegram-presentation.js";

/** Hide Medusa placeholder emails from merchant-facing notifications. */
export function isSyntheticOrderEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const e = email.trim().toLowerCase();
  return e.endsWith("@orders.local") || e.startsWith("telegram+");
}

/** Placeholder names we never show as "Customer: Customer". */
export function isPlaceholderCustomerName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  return /^(customer|unknown|guest|n\/?a|-)$/i.test(name.trim());
}

/** Shared merchant-facing fields for order/payment notifications (no secrets). */
export function buildMerchantOrderNotificationPayload(
  order: MerchantOrder,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  const customerName = [order.shippingAddress?.firstName, order.shippingAddress?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const deliveryName = order.delivery?.customerName?.trim();
  const payload: Record<string, unknown> = {
    orderId: order.id,
    orderCode: formatOrderCode(order.id),
    ...extras,
  };
  if (order.total != null) {
    payload.amount = String(order.total);
  }
  if (order.currencyCode) {
    payload.currencyCode = order.currencyCode.toUpperCase();
  }
  if (order.itemCount != null) {
    payload.itemCount = order.itemCount;
  }
  const itemLines = buildOrderItemLines(order.items, 8);
  if (itemLines.length > 0) {
    payload.itemLines = itemLines;
  }
  if (order.paymentMethod) {
    payload.paymentMethod = order.paymentMethod;
  }
  if (order.paymentStatus) {
    payload.paymentStatus = order.paymentStatus;
  }
  const displayName = deliveryName || customerName;
  if (displayName && !isPlaceholderCustomerName(displayName)) {
    payload.customerName = displayName;
  }
  const phone = order.shippingAddress?.phone || order.delivery?.customerPhone;
  if (phone) {
    payload.customerPhone = phone;
  }
  if (order.email && !isSyntheticOrderEmail(order.email)) {
    payload.customerEmail = order.email;
  }
  if (order.shippingAddress?.city) {
    payload.customerCity = order.shippingAddress.city;
  }
  if (order.delivery?.choice) {
    payload.deliveryChoice = order.delivery.choice;
  }
  return payload;
}

/**
 * Build order.created payload after store cart complete when we may not have a full MerchantOrder yet.
 */
export function buildOrderCreatedPayloadFromComplete(input: {
  orderId: string;
  completeBody: unknown;
  customerName?: string | null;
  customerPhone?: string | null;
  customerCity?: string | null;
  deliveryChoice?: string | null;
  paymentMethod: string;
  paymentStatus?: string | null;
}): Record<string, unknown> {
  const order = extractCompletedOrderRecord(input.completeBody);
  const payload: Record<string, unknown> = {
    orderId: input.orderId,
    orderCode: formatOrderCode(input.orderId),
    paymentMethod: input.paymentMethod,
  };
  if (input.paymentStatus) payload.paymentStatus = input.paymentStatus;
  if (input.deliveryChoice) payload.deliveryChoice = input.deliveryChoice;

  const name = input.customerName?.trim() || null;
  if (name && !isPlaceholderCustomerName(name)) payload.customerName = name;
  if (input.customerPhone?.trim()) payload.customerPhone = input.customerPhone.trim();
  if (input.customerCity?.trim()) payload.customerCity = input.customerCity.trim();

  if (order) {
    const total = order.total ?? order.summary?.total;
    if (total != null && (typeof total === "number" || typeof total === "string")) {
      payload.amount = String(total);
    }
    const currency =
      (typeof order.currency_code === "string" && order.currency_code) ||
      (typeof order.currencyCode === "string" && order.currencyCode);
    if (currency) payload.currencyCode = String(currency).toUpperCase();

    const rawItems = Array.isArray(order.items) ? order.items : [];
    const itemLines: string[] = [];
    for (const raw of rawItems.slice(0, 8)) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const productTitle =
        (typeof item.product_title === "string" && item.product_title) ||
        (typeof item.title === "string" && item.title) ||
        "Item";
      const variantTitle =
        (typeof item.variant_title === "string" && item.variant_title) ||
        (typeof item.subtitle === "string" && item.subtitle) ||
        (item.variant &&
        typeof item.variant === "object" &&
        item.variant !== null &&
        typeof (item.variant as { title?: unknown }).title === "string"
          ? String((item.variant as { title: string }).title)
          : null);
      const quantity =
        typeof item.quantity === "number"
          ? item.quantity
          : typeof item.quantity === "string"
            ? Number(item.quantity)
            : null;
      itemLines.push(
        formatOrderLineItemLabel({
          productTitle,
          title: typeof item.title === "string" ? item.title : productTitle,
          variantTitle,
          quantity: quantity != null && Number.isFinite(quantity) ? quantity : null,
        }),
      );
    }
    if (itemLines.length > 0) {
      payload.itemLines = itemLines;
      payload.itemCount = rawItems.length;
    }
  }

  return payload;
}

function extractCompletedOrderRecord(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const body = data as Record<string, unknown>;
  if (body.type === "order" && typeof body.order === "object" && body.order !== null) {
    return body.order as Record<string, unknown>;
  }
  if (typeof body.id === "string" && body.id.startsWith("order_")) {
    return body;
  }
  if (typeof body.order === "object" && body.order !== null) {
    return body.order as Record<string, unknown>;
  }
  return null;
}

/** Build a rich, non-secret payload for payment.paid (and similar) from a merchant order. */
export function buildPaymentPaidPayload(
  order: MerchantOrder,
  source: string,
): Record<string, unknown> {
  return buildMerchantOrderNotificationPayload(order, {
    source,
    paidAt: new Date().toISOString(),
    paymentStatus: "paid",
  });
}

export function buildOrderCancelledPayload(
  order: MerchantOrder,
  source = "dashboard_cancel",
): Record<string, unknown> {
  return buildMerchantOrderNotificationPayload(order, {
    source,
    orderStatus: "canceled",
  });
}

/** Last 6 of Medusa order id — same convention as the merchant dashboard. */
function formatOrderCode(orderId: string) {
  const raw = orderId.replace(/^order_/i, "");
  return (raw.slice(-6) || orderId.slice(-6)).toUpperCase();
}
