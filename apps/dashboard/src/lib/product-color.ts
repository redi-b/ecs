const NAMED_PRODUCT_COLORS: Record<string, string> = {
  beige: "#e7dcc8",
  black: "#111111",
  blue: "#2563eb",
  brown: "#78350f",
  burgundy: "#7f1d1d",
  clear: "#f8fafc",
  cream: "#fffdd0",
  gold: "#d4af37",
  gray: "#6b7280",
  green: "#16a34a",
  grey: "#6b7280",
  ivory: "#fffff0",
  lavender: "#a78bfa",
  navy: "#1e3a8a",
  olive: "#808000",
  orange: "#ea580c",
  pink: "#db2777",
  purple: "#9333ea",
  red: "#dc2626",
  rose: "#e11d48",
  silver: "#c0c0c0",
  tan: "#d2b48c",
  teal: "#0f766e",
  white: "#ffffff",
  yellow: "#eab308",
};

export function resolveProductColorSwatch(
  optionTitle: string,
  valueLabel: string,
  explicitSwatch?: string | null,
) {
  if (explicitSwatch && /^#[0-9a-f]{6}$/i.test(explicitSwatch)) {
    return explicitSwatch.toLowerCase();
  }

  if (!/^(colou?r|shade)$/i.test(optionTitle.trim())) return null;
  return NAMED_PRODUCT_COLORS[valueLabel.trim().toLowerCase()] ?? null;
}
