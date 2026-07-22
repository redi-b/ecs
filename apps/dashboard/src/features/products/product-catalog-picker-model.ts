/** Shared types and pure helpers for product catalog picker. */

export type ProductCatalogPickItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  searchText: string;
  meta?: string | null;
};

/** Variant under a product (order lines). */
export type ProductCatalogPickVariant = {
  id: string;
  title: string;
  sku?: string | null;
  priceLabel?: string | null;
  /** Structured options: { Size: "M", Color: "Blue" }. */
  options?: Record<string, string>;
};

export type ProductCatalogPickProduct = {
  id: string;
  title: string;
  handle?: string | null;
  thumbnailUrl?: string | null;
  searchText: string;
  variants?: ProductCatalogPickVariant[];
};

export type ProductOptionAxis = {
  title: string;
  values: string[];
};

export const PRODUCT_CATALOG_PAGE_SIZE = 24;

/**
 * Strip product title from Medusa variant titles like "Denim Jacket / XL" → "XL".
 */
export function optionLabelFromVariantTitle(
  variantTitle: string,
  productTitle?: string | null,
): string {
  let rest = variantTitle.trim();
  const product = productTitle?.trim();
  if (product && rest.toLowerCase().startsWith(product.toLowerCase())) {
    rest = rest.slice(product.length).replace(/^\s*[·/\-–—|:]\s*/, "").trim();
  }
  return rest || variantTitle.trim();
}

/**
 * Build option axes (Size, Color, …) from variants.
 * Prefers structured `options` from Medusa (option name + values from product create).
 * Title fallback only when options are missing — never treats product name as a value.
 */
export function buildProductOptionAxes(
  variants: ProductCatalogPickVariant[],
  productTitle?: string | null,
): ProductOptionAxis[] {
  const map = new Map<string, Set<string>>();
  let structured = false;

  for (const variant of variants) {
    const opts = variant.options ?? {};
    const entries = Object.entries(opts).filter(
      ([title, value]) => title && value && title !== "Default",
    );
    if (entries.length > 0) {
      structured = true;
      for (const [title, value] of entries) {
        const set = map.get(title) ?? new Set<string>();
        set.add(value);
        map.set(title, set);
      }
    }
  }

  if (structured) {
    return [...map.entries()].map(([title, values]) => ({
      title,
      values: [...values].sort((a, b) => a.localeCompare(b)),
    }));
  }

  // Fallback only: option values from titles, product name stripped first.
  const partsList = variants
    .map((v) =>
      optionLabelFromVariantTitle(v.title, productTitle)
        .split(/\s*\/\s*/)
        .map((p) => p.trim())
        .filter(Boolean),
    )
    .filter((parts) => parts.length > 0);

  if (partsList.length === 0) {
    return [];
  }

  const maxParts = Math.max(...partsList.map((p) => p.length));
  if (maxParts === 1) {
    const values = [...new Set(partsList.map((p) => p[0]!).filter(Boolean))];
    if (values.length <= 1) return [];
    // Unknown option name without Medusa options payload — generic label.
    return [{ title: "Option", values: values.sort((a, b) => a.localeCompare(b)) }];
  }

  const axes: ProductOptionAxis[] = [];
  for (let i = 0; i < maxParts; i++) {
    const values = new Set<string>();
    for (const parts of partsList) {
      if (parts[i]) values.add(parts[i]!);
    }
    if (values.size > 0) {
      axes.push({
        title: `Option ${i + 1}`,
        values: [...values].sort((a, b) => a.localeCompare(b)),
      });
    }
  }
  return axes;
}

export function resolveVariantByOptions(
  variants: ProductCatalogPickVariant[],
  selection: Record<string, string>,
): ProductCatalogPickVariant | null {
  const keys = Object.keys(selection);
  if (!keys.length) return null;

  const structured = variants.find((variant) => {
    const opts = variant.options ?? {};
    if (!Object.keys(opts).length) return false;
    return keys.every((key) => opts[key] === selection[key]);
  });
  if (structured) return structured;

  // Title fallback: match option values only (product name already stripped by caller axes).
  const orderedValues = Object.values(selection);
  return (
    variants.find((variant) => {
      const opts = variant.options ?? {};
      if (Object.keys(opts).length) return false;
      const label = optionLabelFromVariantTitle(variant.title);
      const parts = label
        .split(/\s*\/\s*/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (orderedValues.length === 1) {
        return label === orderedValues[0] || parts[0] === orderedValues[0];
      }
      if (parts.length !== orderedValues.length) return false;
      return orderedValues.every((value, index) => parts[index] === value);
    }) ?? null
  );
}

export function lowestPriceLabel(variants: ProductCatalogPickVariant[]): string | null {
  let best: number | null = null;
  let label: string | null = null;
  for (const variant of variants) {
    if (!variant.priceLabel) continue;
    const n = Number(variant.priceLabel.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n)) {
      if (!label) label = variant.priceLabel;
      continue;
    }
    if (best == null || n < best) {
      best = n;
      label = variant.priceLabel;
    }
  }
  return label;
}

export function formatVariantChipLabel(variant: ProductCatalogPickVariant) {
  const opts = variant.options ?? {};
  const parts = Object.values(opts).filter(Boolean);
  if (parts.length) return parts.join(" · ");
  // Prefer "XL" over "Denim Jacket / XL" when options payload was missing.
  return optionLabelFromVariantTitle(variant.title);
}
