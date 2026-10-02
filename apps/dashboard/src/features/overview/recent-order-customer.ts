/** Keep customer identity visible without showing both phone and email. */
export function formatRecentOrderCustomer(order: {
  customerName?: string | null | undefined;
  customerPhone?: string | null | undefined;
  email?: string | null | undefined;
}): string | null {
  const name = order.customerName?.trim();
  const contact = order.customerPhone?.trim() || order.email?.trim();
  return [name, contact].filter(Boolean).join(" · ") || null;
}
