import { formatPublicOrderReference } from "@ecs/contracts";

import type { MerchantOrder } from "../../types/index.js";
import { buildOrderItemLines } from "../telegram/telegram-presentation.js";

/** Hide Medusa placeholder emails from merchant-facing notifications. */
export function isSyntheticOrderEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const e = email.trim().toLowerCase();
  return (
    e.endsWith("@orders.local") ||
    e.startsWith("telegram+") ||
    e.startsWith("walk-in@") ||
    e.endsWith(".local")
  );
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
    orderCode: formatPublicOrderReference(order.id, order.customDisplayId),
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
  if (order.paymentStatus && payload.paymentStatus == null) {
    payload.paymentStatus = order.paymentStatus;
  }
  if (order.paymentReference?.trim()) {
    payload.txRef = order.paymentReference.trim();
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
