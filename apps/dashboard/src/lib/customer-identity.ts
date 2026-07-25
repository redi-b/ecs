/**
 * Shared walk-in / synthetic customer detection for merchant UI.
 * Keep in sync with platform-api walk-in email conventions.
 */
export function isWalkInCustomerEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const e = email.trim().toLowerCase();
  return (
    e.startsWith("walk-in@") ||
    e.endsWith("@orders.local") ||
    e.startsWith("telegram+") ||
    e.endsWith(".local")
  );
}
