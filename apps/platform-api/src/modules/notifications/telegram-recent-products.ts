import type { MerchantOrder, MerchantProduct } from "../../types/index.js";
import type { TelegramProductHit } from "./telegram-dialog-state.js";
import { catalogHitFromVariant, formatVariantLabel } from "./telegram-presentation.js";

const MAX_HITS = 6;

/**
 * Build pick list: unique variants from recent orders (newest first), then catalog fill.
 * Order line titles often lack variant options — enrich from catalog when possible.
 */
export function buildRecentProductHits(input: {
  orders: MerchantOrder[];
  catalogProducts: MerchantProduct[];
  limit?: number;
}): TelegramProductHit[] {
  const limit = input.limit ?? MAX_HITS;
  const seen = new Set<string>();
  const hits: TelegramProductHit[] = [];

  const catalogByVariant = new Map<string, { product: MerchantProduct; hit: TelegramProductHit }>();
  for (const product of input.catalogProducts) {
    for (const variant of product.variants ?? []) {
      if (!variant.id) continue;
      catalogByVariant.set(variant.id, {
        product,
        hit: catalogHitFromVariant(product, variant),
      });
    }
  }

  for (const order of input.orders) {
    for (const item of order.items ?? []) {
      const variantId = item.variantId?.trim();
      if (!variantId || seen.has(variantId)) continue;
      seen.add(variantId);

      const fromCatalog = catalogByVariant.get(variantId);
      if (fromCatalog) {
        hits.push(fromCatalog.hit);
      } else {
        const productTitle = (item.title ?? "Product").trim() || "Product";
        hits.push({
          productId: item.productId?.trim() || "",
          productTitle,
          variantId,
          variantTitle: "Default",
          sku: null,
          availableQuantity: null,
        });
      }
      if (hits.length >= limit) return hits;
    }
  }

  for (const product of input.catalogProducts) {
    for (const variant of product.variants ?? []) {
      if (!variant.id || seen.has(variant.id)) continue;
      seen.add(variant.id);
      hits.push(catalogHitFromVariant(product, variant));
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

/** Exported for tests / callers that need variant subtitle only */
export { formatVariantLabel };
