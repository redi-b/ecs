/**
 * Shared walk-in / synthetic customer detection for merchant UI.
 * Keep in sync with platform-api walk-in email conventions.
 */
export function isWalkInCustomerEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const e = email.trim().toLowerCase();
  return e.startsWith("walk-in@") || e.endsWith("@orders.local") || e.startsWith("telegram+");
}

export function getDisplayCustomerEmail(email: string | null | undefined): string | null {
  const value = email?.trim();
  return value && !isSyntheticCustomerEmail(value) ? value : null;
}

export function isSyntheticCustomerEmail(email: string | null | undefined): boolean {
  const value = email?.trim().toLowerCase() ?? "";
  return isWalkInCustomerEmail(value) || value.endsWith(".local");
}
