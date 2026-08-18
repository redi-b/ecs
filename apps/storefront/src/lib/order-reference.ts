/** Customer-facing reference derived from an opaque order ID, not Medusa's global serial display_id. */
export function formatOrderReference(orderId: string, customDisplayId?: string | null) {
  const custom = customDisplayId?.trim();
  if (custom) return custom;
  const suffix = orderId.replace(/^order_/i, "").replace(/[^a-z0-9]/gi, "").slice(-10).toUpperCase();
  return suffix ? `ORD-${suffix}` : "Order";
}
