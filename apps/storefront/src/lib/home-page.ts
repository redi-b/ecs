import { getStorefrontTemplateDefinition } from "@ecs/storefront-templates";

import { listStoreCollections } from "./commerce/catalog";
import { getStoreProductsByIds, listStoreProducts } from "./commerce/products";
import { isStoreError } from "./commerce/result";
import type { StoreCollection, StoreProduct } from "./commerce/types";
import type { PageContext } from "./page-context";

type HomeMerchandising = {
  hero?: { featuredProductId?: string; featuredProductIds?: string[] };
  featuredCollection?: { collectionId?: string; enabled?: boolean; limit?: number };
  featuredProducts: { enabled?: boolean; limit?: number; productIds: string[] };
  products?: { enabled?: boolean; limit?: number; productIds: string[] };
  categories?: { enabled?: boolean; collectionIds?: string[] };
};

export async function loadHomePageModel(
  ctx: Extract<PageContext, { ok: true }>,
  options?: { includeCatalogFallback?: boolean },
) {
  const definition = getStorefrontTemplateDefinition(ctx.config.storefront.templateKey);
  const parsed = definition?.schema.safeParse(ctx.config.storefront.data);
  if (!parsed?.success) return null;

  const data = parsed.data as typeof parsed.data & { home: HomeMerchandising };
  const featured = data.home.featuredProducts;
  const catalog = data.home.products;
  const limit = Math.max(featured.limit ?? 8, catalog?.enabled === false ? 0 : catalog?.limit ?? 0);
  let featuredProducts: StoreProduct[] = [];
  let collectionProducts: StoreProduct[] = [];
  let productsError: string | null = null;
  let collections: StoreCollection[] = [];

  if (featured.enabled !== false || catalog?.enabled !== false) {
    const configuredIds = featured.productIds.length > 0 ? featured.productIds : catalog?.productIds ?? [];
    const productIds = [...new Set([...(data.home.hero?.featuredProductIds ?? []), data.home.hero?.featuredProductId, ...configuredIds].filter((id): id is string => Boolean(id?.trim())))];
    const result = options?.includeCatalogFallback
      ? await listStoreProducts({
          platformApiBaseUrl: ctx.platformApiBaseUrl,
          requestHost: ctx.requestHost,
          regionId: ctx.config.commerce.regionId,
          limit: 48,
        })
      : productIds.length
        ? await getStoreProductsByIds({
          platformApiBaseUrl: ctx.platformApiBaseUrl,
          requestHost: ctx.requestHost,
          regionId: ctx.config.commerce.regionId,
          productIds: productIds.slice(0, limit),
          })
        : await listStoreProducts({
          platformApiBaseUrl: ctx.platformApiBaseUrl,
          requestHost: ctx.requestHost,
          regionId: ctx.config.commerce.regionId,
          limit,
          });
    if (isStoreError(result)) productsError = result.message;
    else featuredProducts = result.products;
  }

  const collection = data.home.featuredCollection;
  if (collection?.enabled && collection.collectionId?.trim()) {
    const result = await listStoreProducts({
      platformApiBaseUrl: ctx.platformApiBaseUrl,
      requestHost: ctx.requestHost,
      regionId: ctx.config.commerce.regionId,
      collectionId: collection.collectionId.trim(),
      limit: collection.limit ?? 8,
    });
    if (!isStoreError(result)) collectionProducts = result.products;
  }

  if (data.home.categories?.enabled !== false) {
    const result = await listStoreCollections({
      platformApiBaseUrl: ctx.platformApiBaseUrl,
      requestHost: ctx.requestHost,
      limit: 100,
    });
    if (!isStoreError(result)) collections = result.collections;
  }

  return {
    collectionProducts,
    collections,
    productsResult: productsError
      ? { ok: false as const, status: 502, message: productsError }
      : { products: featuredProducts },
  };
}
