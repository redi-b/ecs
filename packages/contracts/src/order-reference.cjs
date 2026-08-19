/** Tenant-safe public reference; never expose Medusa's shared global display_id. */
function formatPublicOrderReference(orderId, customDisplayId) {
  const custom = customDisplayId?.trim();
  if (custom) return custom;
  const suffix = orderId
    .replace(/^order_/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(-10)
    .toUpperCase();
  return suffix ? `ORD-${suffix}` : "Order";
}

module.exports = { formatPublicOrderReference };
