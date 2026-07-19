import type { MerchantOrder, MerchantProduct } from "../../types/index.js";
import type { TelegramProductHit } from "./telegram-dialog-state.js";

const MAX_HITS = 6;

/**
 * Build pick list: unique variants from recent orders (newest first), then catalog fill.
 */
export function buildRecentProductHits(input: {
  orders: MerchantOrder[];
  catalogProducts: MerchantProduct[];
  limit?: number;
}): TelegramProductHit[] {
  const limit = input.limit ?? MAX_HITS;
  const seen = new Set<string>();
  const hits: TelegramProductHit[] = [];

  for (const order of input.orders) {
    for (const item of order.items ?? []) {
      const variantId = item.variantId?.trim();
      if (!variantId || seen.has(variantId)) continue;
      seen.add(variantId);
      const productTitle = (item.title ?? "Product").trim() || "Product";
      hits.push({
        productId: item.productId?.trim() || "",
        productTitle,
        variantId,
        variantTitle: "Default",
        sku: null,
        availableQuantity: null,
      });
      if (hits.length >= limit) return hits;
    }
  }

  for (const product of input.catalogProducts) {
    for (const variant of product.variants ?? []) {
      if (!variant.id || seen.has(variant.id)) continue;
      seen.add(variant.id);
      const available =
        variant.stock?.availableQuantity ?? variant.stock?.stockedQuantity ?? null;
      hits.push({
        productId: product.id,
        productTitle: product.title ?? "Product",
        variantId: variant.id,
        variantTitle: variant.title ?? "Default",
        sku: variant.sku ?? null,
        availableQuantity: available,
      });
      if (hits.length >= limit) return hits;
    }
  }

  return hits;
}

export function productHitsFromCatalog(
  products: MerchantProduct[],
  limit = MAX_HITS,
): TelegramProductHit[] {
  return buildRecentProductHits({ orders: [], catalogProducts: products, limit });
}
