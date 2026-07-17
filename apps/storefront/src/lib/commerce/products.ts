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
  "*images",
  "+thumbnail",
  "+handle",
  "+description",
].join(",");

export async function listStoreProducts(
  options: HostedStoreRequest & {
    limit?: number;
    offset?: number;
    regionId?: string | null;
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
    return { ok: false, status: 404, message: "product_not_found" };
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
    return { ok: false, status: 404, message: "product_not_found" };
  }

  return { product };
}
