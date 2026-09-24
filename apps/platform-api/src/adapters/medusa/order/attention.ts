import type { MerchantOrder } from "../../../types/merchant-order.js";

/** Work the merchant can act on; COD payment is expected until handoff. */
export function getOrderAttentionReasons(order: MerchantOrder) {
  const status = order.status?.toLowerCase() ?? "";
  if (status.includes("cancel") || status.includes("complete")) return [];
  const fulfillment = order.fulfillmentStatus?.toLowerCase() ?? "";
  const payment = order.paymentStatus?.toLowerCase() ?? "";
  const reasons: Array<"fulfillment" | "payment"> = [];
  if (!["fulfilled", "shipped", "delivered"].includes(fulfillment)) reasons.push("fulfillment");
  const unpaid = ["not_paid", "awaiting", "authorized", "requires_action", "pending"].includes(
    payment,
  );
  if (unpaid && (order.paymentMethod !== "cod" || fulfillment === "delivered"))
    reasons.push("payment");
  return reasons;
}
