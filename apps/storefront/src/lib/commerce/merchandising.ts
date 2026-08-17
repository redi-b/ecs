import type { StoreProduct, StoreProductVariant } from "./types";

export type ProductBadge =
  | { kind: "out-of-stock"; label: "Out of stock" }
  | { kind: "promotion"; label: string; percentage: number };

const pricedVariant = (product: StoreProduct, variant?: StoreProductVariant | null) =>
  variant ?? product.variants.find((item) => item.inStock) ?? product.variants[0] ?? null;

export const resolveProductBadge = (
  product: StoreProduct,
  variant?: StoreProductVariant | null,
): ProductBadge | null => {
  const selected = pricedVariant(product, variant);
  const hasInventory = product.variants.some((item) => item.inStock);
  if (product.variants.length > 0 && !hasInventory) {
    return { kind: "out-of-stock", label: "Out of stock" };
  }
  const percentage = selected?.discountPercentage ?? product.discountPercentage ?? null;
  const original = selected?.originalPriceAmount ?? product.originalPriceAmount ?? null;
  const current = selected?.priceAmount ?? product.priceAmount;
  if (
    percentage != null && percentage > 0 && percentage < 100 &&
    original != null && current != null && original > current
  ) {
    return { kind: "promotion", label: `${percentage}% off`, percentage };
  }
  return null;
};
