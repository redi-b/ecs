import type { MerchantOrder } from "../../types/index.js";

/** Build a rich, non-secret payload for payment.paid (and similar) from a merchant order. */
export function buildPaymentPaidPayload(
  order: MerchantOrder,
  source: string,
): Record<string, unknown> {
  const customerName = [order.shippingAddress?.firstName, order.shippingAddress?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const deliveryName = order.delivery?.customerName?.trim();
  const payload: Record<string, unknown> = {
    orderId: order.id,
    source,
    paidAt: new Date().toISOString(),
    paymentStatus: "paid",
  };
  if (order.displayId != null) {
    payload.orderDisplayId = String(order.displayId);
  }
  if (order.total != null) {
    payload.amount = String(order.total);
  }
  if (order.currencyCode) {
    payload.currencyCode = order.currencyCode.toUpperCase();
  }
  if (order.itemCount != null) {
    payload.itemCount = order.itemCount;
  }
  if (order.paymentMethod) {
    payload.paymentMethod = order.paymentMethod;
  }
  if (order.paymentReference) {
    payload.paymentReference = order.paymentReference;
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
