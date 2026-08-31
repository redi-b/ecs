import { getStorefrontTemplateDefinition } from "@ecs/storefront-templates";

import { listStoreCategories, listStoreCollections } from "./commerce/catalog";
import { getStoreProductsByIds, listStoreProducts } from "./commerce/products";
import { isStoreError } from "./commerce/result";
import type { StoreCategory, StoreCollection, StoreProduct } from "./commerce/types";
import type { PageContext } from "./page-context";

type ProductSelection = { enabled?: boolean; limit?: number; productIds: string[] };
type CollectionSelection = { collectionId?: string; enabled?: boolean; limit?: number };
type CategorySelection = { enabled?: boolean; collectionIds?: string[] };

type ResolvedHomeMerchandising = {
  heroProductIds: string[];
  featuredCollection?: CollectionSelection;
  featuredProducts: ProductSelection;
  products?: ProductSelection;
  categories?: CategorySelection;
  allowUnselectedProductFallback: boolean;
};

export async function loadHomePageModel(
  ctx: Extract<PageContext, { ok: true }>,
  options?: { includeCatalogFallback?: boolean },
) {
  const definition = getStorefrontTemplateDefinition(ctx.config.storefront.templateKey);
  if (!definition) return null;
  const parsed = definition.schema.safeParse(ctx.config.storefront.data);
  if (!parsed.success) return null;

  const merchandising = resolveHomeMerchandising(definition.homeCatalog, parsed.data);
  if (!merchandising) return null;

  const featured = merchandising.featuredProducts;
  const catalog = merchandising.products;
  const limit = Math.max(featured.limit ?? 8, catalog?.enabled === false ? 0 : catalog?.limit ?? 0);
  let featuredProducts: StoreProduct[] = [];
  let collectionProducts: StoreProduct[] = [];
  let productsError: string | null = null;
  let collections: StoreCollection[] = [];
  let categories: StoreCategory[] = [];

  if (featured.enabled !== false || catalog?.enabled !== false) {
    const configuredIds = featured.productIds.length > 0 ? featured.productIds : catalog?.productIds ?? [];
    const productIds = [...new Set([...merchandising.heroProductIds, ...configuredIds])];
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
        : merchandising.allowUnselectedProductFallback
          ? await listStoreProducts({
              platformApiBaseUrl: ctx.platformApiBaseUrl,
              requestHost: ctx.requestHost,
              regionId: ctx.config.commerce.regionId,
              limit,
            })
          : null;
    if (result && isStoreError(result)) productsError = result.message;
    else if (result) featuredProducts = result.products;
  }

  const collection = merchandising.featuredCollection;
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

  if (merchandising.categories?.enabled !== false) {
    const result = await listStoreCollections({
      platformApiBaseUrl: ctx.platformApiBaseUrl,
      requestHost: ctx.requestHost,
      limit: 100,
    });
    if (!isStoreError(result)) collections = result.collections;
    const categoriesResult = await listStoreCategories({
      platformApiBaseUrl: ctx.platformApiBaseUrl,
      requestHost: ctx.requestHost,
      limit: 100,
    });
    if (!isStoreError(categoriesResult)) categories = categoriesResult.categories;
  }

  return {
    collectionProducts,
    collections,
    categories,
    productsResult: productsError
      ? { ok: false as const, status: 502, message: productsError }
      : { products: featuredProducts },
  };
}

export function resolveHomeMerchandising(
  contract: {
    featuredProductsPath: string;
    catalogProductsPath?: string;
    heroProductIdPaths: readonly string[];
    featuredCollectionPath?: string;
    categoriesPath?: string;
    allowUnselectedProductFallback: boolean;
  },
  data: unknown,
): ResolvedHomeMerchandising | null {
  const featuredProducts = valueAtPath(data, contract.featuredProductsPath);
  if (!isProductSelection(featuredProducts)) return null;

  const catalogValue = contract.catalogProductsPath
    ? valueAtPath(data, contract.catalogProductsPath)
    : undefined;
  const products = isProductSelection(catalogValue) ? catalogValue : undefined;
  const collectionValue = contract.featuredCollectionPath
    ? valueAtPath(data, contract.featuredCollectionPath)
    : undefined;
  const categoriesValue = contract.categoriesPath
    ? valueAtPath(data, contract.categoriesPath)
    : undefined;
  const heroProductIds = contract.heroProductIdPaths.flatMap((path) => {
    const value = valueAtPath(data, path);
    if (typeof value === "string" && value.trim()) return [value];
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
  });

  return {
    heroProductIds,
    featuredProducts,
    products,
    featuredCollection: isCollectionSelection(collectionValue) ? collectionValue : undefined,
    categories: isCategorySelection(categoriesValue) ? categoriesValue : undefined,
    allowUnselectedProductFallback: contract.allowUnselectedProductFallback,
  };
}

function valueAtPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) =>
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)[key]
      : undefined, value);
}

function isProductSelection(value: unknown): value is ProductSelection {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Array.isArray((value as ProductSelection).productIds);
}

function isCollectionSelection(value: unknown): value is CollectionSelection {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCategorySelection(value: unknown): value is CategorySelection {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
