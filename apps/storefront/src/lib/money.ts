/** Medusa store amounts are major currency units (not cents). */
export function formatMoney(
  amount: number | null | undefined,
  currencyCode: string | null | undefined = "ETB",
  locale: "en" | "am" = "en",
) {
  if (amount == null || !Number.isFinite(amount)) {
    return "-";
  }

  const code = (currencyCode ?? "ETB").toUpperCase();

  try {
    return new Intl.NumberFormat(locale === "am" ? "am-ET" : "en-ET", {
      currency: code,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
      style: "currency",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}
