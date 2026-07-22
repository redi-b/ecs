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
  "*images",
  "*collection",
  "*categories",
  "+thumbnail",
  "+handle",
  "+description",
  "+collection_id",
].join(",");

export async function listStoreProducts(
  options: HostedStoreRequest & {
    limit?: number;
    offset?: number;
    regionId?: string | null;
    q?: string | null;
    collectionId?: string | null;
    categoryId?: string | null;
    order?: string | null;
  },
): Promise<StoreProductsResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/products",
    searchParams: {
      limit: options.limit ?? 24,
      offset: options.offset ?? 0,
      region_id: options.regionId,
      fields: PRODUCT_FIELDS,
      ...(options.q?.trim() ? { q: options.q.trim() } : {}),
      ...(options.collectionId?.trim()
        ? { collection_id: options.collectionId.trim() }
        : {}),
      ...(options.categoryId?.trim()
        ? { category_id: options.categoryId.trim() }
        : {}),
      ...(options.order?.trim() ? { order: options.order.trim() } : {}),
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
