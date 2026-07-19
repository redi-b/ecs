import type { MerchantOrder } from "../../types/index.js";
import { buildOrderItemLines } from "./telegram-presentation.js";

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
  if (customerName || deliveryName) {
    payload.customerName = customerName || deliveryName;
  }
  const phone = order.shippingAddress?.phone || order.delivery?.customerPhone;
  if (phone) {
    payload.customerPhone = phone;
  }
  if (order.email) {
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
