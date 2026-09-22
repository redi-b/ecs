import { asError, getNumber, isRecord, storeFetch } from "./http.js";
import { normalizeProduct } from "./normalize.js";
import type { HostedStoreRequest, StorefrontError, StoreProduct, StoreProductsResponse } from "./types.js";

const PRODUCT_FIELDS = [
  "*variants.calculated_price",
  "*variants.options",
  "+variants.inventory_quantity",
  "+variants.manage_inventory",
  "+variants.allow_backorder",
  "+variants.sku",
  "*options",
  "*options.values",
  "+options.values.metadata",
  "*images",
  "*collection",
  "*categories",
  "+thumbnail",
  "+handle",
  "+description",
  "+collection_id",
  "+metadata",
].join(",");

type ProductSearchResponse = {
  facet_distribution?: {
    category_ids?: Record<string, number>;
    collection_id?: Record<string, number>;
    option_pairs?: Record<string, number>;
  };
  facet_stats?: { price_min_etb?: { min: number; max: number } };
  product_ids: string[];
  count: number;
  index_document_count?: number;
  limit: number;
  offset: number;
};

function parseFacetCounts(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        Number.isSafeInteger(entry[1]) && Number(entry[1]) >= 0,
    ),
  );
}

function parsePriceFacet(value: unknown) {
  if (!isRecord(value)) return null;
  const min = getNumber(value.min);
  const max = getNumber(value.max);
  return min !== undefined && max !== undefined ? { min, max } : null;
}

function parseOptionFacets(counts: Record<string, number> | undefined) {
  const groups = new Map<string, Array<{ count: number; token: string; value: string }>>();
  for (const [token, count] of Object.entries(counts ?? {})) {
    try {
      const pair: unknown = JSON.parse(token);
      if (!Array.isArray(pair) || pair.length !== 2 ||
        typeof pair[0] !== "string" || typeof pair[1] !== "string") continue;
      const name = pair[0].trim();
      const value = pair[1].trim();
      if (!name || !value) continue;
      groups.set(name, [...(groups.get(name) ?? []), { count, token, value }]);
    } catch {
      // Ignore malformed legacy facet values while a search index is being upgraded.
    }
  }
  return [...groups.entries()]
    .map(([name, values]) => ({
      name,
      values: values.sort((a, b) => a.value.localeCompare(b.value)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseProductSearchResponse(value: unknown): ProductSearchResponse | null {
  if (!isRecord(value) || !Array.isArray(value.product_ids)) return null;
  const productIds = value.product_ids.filter((id): id is string => typeof id === "string");
  const count = getNumber(value.count);
  const limit = getNumber(value.limit);
  const offset = getNumber(value.offset);
  const indexDocumentCount = getNumber(value.index_document_count);
  const facetDistribution = isRecord(value.facet_distribution)
    ? {
        category_ids: parseFacetCounts(value.facet_distribution.category_ids),
        collection_id: parseFacetCounts(value.facet_distribution.collection_id),
        option_pairs: parseFacetCounts(value.facet_distribution.option_pairs),
      }
    : undefined;
  const facetStats = isRecord(value.facet_stats)
    ? { price_min_etb: parsePriceFacet(value.facet_stats.price_min_etb) ?? undefined }
    : undefined;
  if (count === undefined || limit === undefined || offset === undefined) return null;
  return {
    product_ids: productIds,
    count,
    limit,
    offset,
    ...(facetDistribution
      ? {
          facet_distribution: {
            ...(facetDistribution.category_ids
              ? { category_ids: facetDistribution.category_ids }
              : {}),
            ...(facetDistribution.collection_id
              ? { collection_id: facetDistribution.collection_id }
              : {}),
            ...(facetDistribution.option_pairs
              ? { option_pairs: facetDistribution.option_pairs }
              : {}),
          },
        }
      : {}),
    ...(facetStats ? { facet_stats: facetStats } : {}),
    ...(indexDocumentCount !== undefined ? { index_document_count: indexDocumentCount } : {}),
  };
}

async function searchStoreProducts(
  options: HostedStoreRequest & {
    categoryId?: string | null;
    collectionId?: string | null;
    limit?: number;
    offset?: number;
    order?: string | null;
    regionId?: string | null;
    optionPairs?: string[];
    priceMin?: number | null;
    priceMax?: number | null;
    q: string;
  },
): Promise<StoreProductsResponse | null> {
  try {
    const response = await storeFetch({
      ...options,
      path: "/store/product-search",
      searchParams: {
        q: options.q,
        category_id: options.categoryId,
        collection_id: options.collectionId,
        option: options.optionPairs,
        price_min: options.priceMin,
        price_max: options.priceMax,
        limit: options.limit ?? 24,
        offset: options.offset ?? 0,
        order: options.order,
      },
    });
    if (!response.ok) return null;

    const search = parseProductSearchResponse(await response.json().catch(() => undefined));
    if (!search) return null;
    if (search.index_document_count === 0) return null;
    if (!search.product_ids.length) {
      return {
        products: [], count: search.count, limit: search.limit, offset: search.offset,
        facets: {
          categories: search.facet_distribution?.category_ids ?? {},
          collections: search.facet_distribution?.collection_id ?? {},
          options: parseOptionFacets(search.facet_distribution?.option_pairs),
          price: search.facet_stats?.price_min_etb ?? null,
        },
      };
    }

    const hydrated = await getStoreProductsByIds({
      ...options,
      productIds: search.product_ids,
      regionId: options.regionId,
    });
    if (!("products" in hydrated)) return null;
    return {
      products: hydrated.products,
      count: search.count,
      limit: search.limit,
      offset: search.offset,
      facets: {
        categories: search.facet_distribution?.category_ids ?? {},
        collections: search.facet_distribution?.collection_id ?? {},
        options: parseOptionFacets(search.facet_distribution?.option_pairs),
        price: search.facet_stats?.price_min_etb ?? null,
      },
    };
  } catch {
    return null;
  }
}

export async function listStoreProducts(
  options: HostedStoreRequest & {
    limit?: number;
    offset?: number;
    regionId?: string | null;
    q?: string | null;
    collectionId?: string | null;
    categoryId?: string | null;
    optionPairs?: string[];
    priceMin?: number | null;
    priceMax?: number | null;
    order?: string | null;
  },
): Promise<StoreProductsResponse | StorefrontError> {
  const query = options.q?.trim();
  const order = options.order?.trim();
  const supportedSearchOrder = !order || ["created_at", "title", "-title", "price", "-price"].includes(order);
  const canUseSearchIndex = supportedSearchOrder && (!query || query.length >= 2);
  if (canUseSearchIndex) {
    const result = await searchStoreProducts({ ...options, q: query ?? "" });
    if (result) return result;
    const requiresIndex = Boolean(
      options.optionPairs?.length || options.priceMin != null || options.priceMax != null ||
      order === "price" || order === "-price",
    );
    if (requiresIndex) {
      return {
        ok: false,
        status: 503,
        message: "Product filters are temporarily unavailable. Please try again.",
      };
    }
  }

  const response = await storeFetch({
    ...options,
    path: "/store/products",
    searchParams: {
      limit: options.limit ?? 24,
      offset: options.offset ?? 0,
      region_id: options.regionId,
      fields: PRODUCT_FIELDS,
      ...(query ? { q: query } : {}),
      ...(options.collectionId?.trim()
        ? { collection_id: options.collectionId.trim() }
        : {}),
      ...(options.categoryId?.trim()
        ? { category_id: options.categoryId.trim() }
        : {}),
      ...(order && ["created_at", "title", "-title"].includes(order) ? { order } : {}),
    },
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  return {
    count: getNumber(isRecord(data) ? data.count : undefined),
    limit: getNumber(isRecord(data) ? data.limit : undefined),
    offset: getNumber(isRecord(data) ? data.offset : undefined),
    products: Array.isArray(isRecord(data) ? data.products : null)
      ? (data as { products: unknown[] }).products.map(normalizeProduct)
      : [],
  };
}

export async function getStoreProductByHandle(
  options: HostedStoreRequest & {
    handle: string;
    regionId?: string | null;
  },
): Promise<{ product: StoreProduct } | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/products",
    searchParams: {
      handle: options.handle,
      limit: 1,
      region_id: options.regionId,
      fields: PRODUCT_FIELDS,
    },
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  const products = Array.isArray(isRecord(data) ? data.products : null)
    ? (data as { products: unknown[] }).products.map(normalizeProduct)
    : [];
  const product = products[0];

  if (!product?.id) {
    return { ok: false, status: 404, message: "This product is unavailable or does not exist." };
  }

  return { product };
}

export async function getStoreProductById(
  options: HostedStoreRequest & {
    productId: string;
    regionId?: string | null;
  },
): Promise<{ product: StoreProduct } | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: `/store/products/${encodeURIComponent(options.productId)}`,
    searchParams: {
      region_id: options.regionId,
      fields: PRODUCT_FIELDS,
    },
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  const product = normalizeProduct(isRecord(data) ? data.product : data);
  if (!product.id) {
    return { ok: false, status: 404, message: "This product is unavailable or does not exist." };
  }

  return { product };
}

/** Resolve products by id list, preserving input order. Missing ids are skipped. */
export async function getStoreProductsByIds(
  options: HostedStoreRequest & {
    productIds: string[];
    regionId?: string | null;
  },
): Promise<StoreProductsResponse | StorefrontError> {
  const ids = [...new Set(options.productIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) {
    return { products: [], count: 0, limit: 0, offset: 0 };
  }

  // Medusa Store API accepts repeated id filters; fall back to sequential retrieve.
  const response = await storeFetch({
    ...options,
    path: "/store/products",
    searchParams: {
      limit: ids.length,
      offset: 0,
      region_id: options.regionId,
      fields: PRODUCT_FIELDS,
      id: ids,
    },
  });
  const data = await response.json().catch(() => undefined);

  if (response.ok) {
    const listed = Array.isArray(isRecord(data) ? data.products : null)
      ? (data as { products: unknown[] }).products.map(normalizeProduct)
      : [];
    const byId = new Map(listed.filter((p) => p.id).map((p) => [p.id, p]));
    const ordered = ids.map((id) => byId.get(id)).filter((p): p is StoreProduct => Boolean(p));
    if (ordered.length > 0 || listed.length === 0) {
      return { products: ordered, count: ordered.length, limit: ids.length, offset: 0 };
    }
  }

  const products: StoreProduct[] = [];
  for (const productId of ids) {
    const result = await getStoreProductById({ ...options, productId });
    if (!("ok" in result && result.ok === false) && "product" in result) {
      products.push(result.product);
    }
  }
  return { products, count: products.length, limit: ids.length, offset: 0 };
}
