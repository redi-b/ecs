/** Normalize Ethiopian mobile numbers while preserving valid international numbers. */
export function normalizeOperationalPhone(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return null;

  if (/^0\d{9}$/.test(digits)) return `251${digits.slice(1)}`;
  if (/^9\d{8}$/.test(digits)) return `251${digits}`;
  if (/^251\d{9}$/.test(digits)) return digits;
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

/**
 * Medusa requires an email even for offline customers. Use a stable, internal
 * address per shop and phone so repeat counter/phone orders share one profile.
 */
export function getOperationalCustomerEmail(input: {
  email?: string | null | undefined;
  phone?: string | null | undefined;
  tenantId: string;
}): string | null {
  const email = input.email?.trim().toLowerCase();
  if (email) return email;

  const phone = normalizeOperationalPhone(input.phone);
  if (!phone) return null;

  const tenantKey = input.tenantId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  return `${phone}.${tenantKey || "shop"}@customers.local`;
}

export function isSyntheticCustomerEmail(value: string | null | undefined): boolean {
  const email = value?.trim().toLowerCase() ?? "";
  return (
    email.startsWith("walk-in@") ||
    email.endsWith("@orders.local") ||
    email.startsWith("telegram+") ||
    email.endsWith(".local")
  );
}
