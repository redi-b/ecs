import { getStorefrontTemplateDefinition } from "@ecs/storefront-templates";

import { listStoreCategories, listStoreCollections } from "./commerce/catalog";
import { getStoreProductsByIds, listStoreProducts } from "./commerce/products";
import { isStoreError } from "./commerce/result";
import type { StoreCategory, StoreCollection, StoreProduct } from "./commerce/types";
import type { PageContext } from "./page-context";

type ProductSelection = { enabled?: boolean; limit?: number; productIds: string[] };
type CategorySelection = {
  enabled?: boolean;
  categoryIds?: string[];
  /** @deprecated Existing storefront data may still carry collection selections. */
  collectionIds?: string[];
};

export type ResolvedHomeMerchandising = {
  heroProductIds: string[];
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
  const limit = Math.max(
    featured.limit ?? 8,
    catalog?.enabled === false ? 0 : (catalog?.limit ?? 0),
  );
  let featuredProducts: StoreProduct[] = [];
  let productsError: string | null = null;
  let collections: StoreCollection[] = [];
  let categories: StoreCategory[] = [];

  if (featured.enabled !== false || catalog?.enabled !== false) {
    const productIds = resolveHomeProductIds(merchandising);
    const result =
      options?.includeCatalogFallback || merchandising.categories?.enabled !== false
        ? await loadPreviewProducts({ ctx, productIds })
        : productIds.length
          ? await getStoreProductsByIds({
              platformApiBaseUrl: ctx.platformApiBaseUrl,
              requestHost: ctx.requestHost,
              locale: ctx.commerceLocale,
              regionId: ctx.config.commerce.regionId,
              productIds: productIds.slice(0, 48),
            })
          : merchandising.allowUnselectedProductFallback
            ? await listStoreProducts({
                platformApiBaseUrl: ctx.platformApiBaseUrl,
                requestHost: ctx.requestHost,
                locale: ctx.commerceLocale,
                regionId: ctx.config.commerce.regionId,
                limit,
              })
            : null;
    if (result && isStoreError(result)) productsError = result.message;
    else if (result) featuredProducts = result.products;
  }

  if (merchandising.categories?.enabled !== false) {
    const result = await listStoreCollections({
      platformApiBaseUrl: ctx.platformApiBaseUrl,
      requestHost: ctx.requestHost,
      locale: ctx.commerceLocale,
      limit: 100,
    });
    if (!isStoreError(result)) collections = result.collections;
    const categoriesResult = await listStoreCategories({
      platformApiBaseUrl: ctx.platformApiBaseUrl,
      requestHost: ctx.requestHost,
      locale: ctx.commerceLocale,
      limit: 100,
    });
    if (!isStoreError(categoriesResult)) categories = categoriesResult.categories;
  }

  return {
    collections,
    categories,
    productsResult: productsError
      ? { ok: false as const, status: 502, message: productsError }
      : { products: featuredProducts },
  };
}

export function resolveHomeProductIds(merchandising: ResolvedHomeMerchandising) {
  return [
    ...new Set([
      ...merchandising.heroProductIds,
      ...merchandising.featuredProducts.productIds,
      ...(merchandising.products?.productIds ?? []),
    ]),
  ];
}

async function loadPreviewProducts({
  ctx,
  productIds,
}: {
  ctx: Extract<PageContext, { ok: true }>;
  productIds: string[];
}) {
  const [catalog, selected] = await Promise.all([
    listStoreProducts({
      platformApiBaseUrl: ctx.platformApiBaseUrl,
      requestHost: ctx.requestHost,
      locale: ctx.commerceLocale,
      regionId: ctx.config.commerce.regionId,
      limit: 48,
    }),
    productIds.length
      ? getStoreProductsByIds({
          platformApiBaseUrl: ctx.platformApiBaseUrl,
          requestHost: ctx.requestHost,
          locale: ctx.commerceLocale,
          regionId: ctx.config.commerce.regionId,
          productIds,
        })
      : null,
  ]);
  if (isStoreError(catalog)) return catalog;
  if (selected && isStoreError(selected)) return selected;

  const products = [...(selected?.products ?? []), ...catalog.products].filter(
    (product, index, all) => all.findIndex((candidate) => candidate.id === product.id) === index,
  );
  return { ...catalog, products };
}

export function resolveHomeMerchandising(
  contract: {
    featuredProductsPath: string;
    catalogProductsPath?: string;
    heroProductIdPaths: readonly string[];
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
    categories: isCategorySelection(categoriesValue) ? categoriesValue : undefined,
    allowUnselectedProductFallback: contract.allowUnselectedProductFallback,
  };
}

function valueAtPath(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object" && !Array.isArray(current)
          ? (current as Record<string, unknown>)[key]
          : undefined,
      value,
    );
}

function isProductSelection(value: unknown): value is ProductSelection {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Array.isArray((value as ProductSelection).productIds)
  );
}

function isCategorySelection(value: unknown): value is CategorySelection {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
