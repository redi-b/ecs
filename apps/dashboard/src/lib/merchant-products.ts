import type {
  MerchantProduct,
  MerchantProductCategories,
  MerchantProductCategory,
  MerchantProductCollection,
  MerchantProductCollections,
  MerchantProductStock,
  MerchantProducts,
  MerchantDeleteResult,
  MerchantBatchDeleteResult,
} from "@ecs/contracts";
import {
  merchantProductCategoriesSchema,
  merchantProductCategorySchema,
  merchantProductCollectionSchema,
  merchantProductCollectionsSchema,
  merchantProductMutationSchema,
  merchantProductStockResponseSchema,
  merchantProductsSchema,
  platformErrorSchema,
  merchantDeleteResultSchema,
  merchantBatchDeleteResultSchema,
} from "@ecs/contracts";
import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";

export type MerchantProductsResult =
  | {
      ok: true;
      products: MerchantProducts;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductMutationResult =
  | {
      ok: true;
      product: MerchantProduct;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductResult =
  | {
      ok: true;
      product: MerchantProduct;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductCategoriesResult =
  | ({
      ok: true;
    } & MerchantProductCategories)
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductCollectionsResult =
  | ({
      ok: true;
    } & MerchantProductCollections)
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductCategoryMutationResult =
  | {
      ok: true;
      category: MerchantProductCategory;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductCollectionMutationResult =
  | {
      ok: true;
      collection: MerchantProductCollection;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductStockResult =
  | {
      ok: true;
      stock: MerchantProductStock;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantDeleteActionResult =
  | {
      ok: true;
      id: string;
      deleted: boolean;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantBatchDeleteActionResult =
  | {
      ok: true;
      ids: string[];
      deleted: boolean;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductWriteInput = {
  categoryIds?: string[] | undefined;
  collectionId?: string | null | undefined;
  currencyCode?: string | null | undefined;
  description?: string | null | undefined;
  handle?: string | null | undefined;
  imageUrls?: string[] | undefined;
  options?: Array<{ title: string; values: string[] }> | undefined;
  priceAmount?: number | undefined;
  status?: string | null | undefined;
  thumbnail?: string | null | undefined;
  title?: string | null | undefined;
  variants?:
    | Array<{
        currencyCode: string;
        optionValues: Record<string, string>;
        priceAmount: number;
        sku?: string | null | undefined;
        stockedQuantity?: number | undefined;
      }>
    | undefined;
};

export async function createMerchantProduct(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  product: MerchantProductWriteInput;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantProductMutationResult> {
  const response = await sendProductMutation({
    cookieHeader: options.cookieHeader,
    fetcher: options.fetcher,
    platformApiBaseUrl: options.platformApiBaseUrl,
    product: options.product,
    requestHost: options.requestHost,
    tenantId: options.tenantId,
  });

  return parseProductMutationResponse(response);
}

export async function createMerchantProductCategory(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  handle?: string | null | undefined;
  name: string;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantProductCategoryMutationResult> {
  const response = await sendTaxonomyMutation({
    body: {
      name: options.name,
      handle: options.handle,
    },
    cookieHeader: options.cookieHeader,
    fetcher: options.fetcher,
    platformApiBaseUrl: options.platformApiBaseUrl,
    requestHost: options.requestHost,
    resource: "product-categories",
    tenantId: options.tenantId,
  });

  return parseProductCategoryMutationResponse(response);
}

export async function createMerchantProductCollection(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  handle?: string | null | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
  title: string;
}): Promise<MerchantProductCollectionMutationResult> {
  const response = await sendTaxonomyMutation({
    body: {
      title: options.title,
      handle: options.handle,
    },
    cookieHeader: options.cookieHeader,
    fetcher: options.fetcher,
    platformApiBaseUrl: options.platformApiBaseUrl,
    requestHost: options.requestHost,
    resource: "product-collections",
    tenantId: options.tenantId,
  });

  return parseProductCollectionMutationResponse(response);
}

export async function getMerchantProduct(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  productId: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantProductResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getProductMutationUrl(options), {
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: options.tenantId?.trim() ? undefined : options.requestHost,
    }),
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseProductResponse(response);
}

export async function getMerchantProductStock(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  productId: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantProductStockResult> {
  const response = await fetchProductStockResource(options);

  return parseProductStockResponse(response);
}

export async function getMerchantProductCategories(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantProductCategoriesResult> {
  const response = await fetchProductResource({
    ...options,
    resource: "product-categories",
  });

  return parseProductCategoriesResponse(response);
}

export async function getMerchantProductCollections(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantProductCollectionsResult> {
  const response = await fetchProductResource({
    ...options,
    resource: "product-collections",
  });

  return parseProductCollectionsResponse(response);
}

export async function getMerchantProducts(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantProductsResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getProductsUrl(options), {
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: options.tenantId?.trim() ? undefined : options.requestHost,
    }),
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : response.statusText || "Products request failed",
    };
  }

  const parsed = merchantProductsSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_products_response",
    };
  }

  return {
    ok: true,
    products: parsed.data,
  };
}

export async function updateMerchantProduct(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  product: MerchantProductWriteInput;
  productId: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantProductMutationResult> {
  const response = await sendProductMutation({
    cookieHeader: options.cookieHeader,
    fetcher: options.fetcher,
    platformApiBaseUrl: options.platformApiBaseUrl,
    product: options.product,
    productId: options.productId,
    requestHost: options.requestHost,
    tenantId: options.tenantId,
  });

  return parseProductMutationResponse(response);
}

export async function updateMerchantProductStock(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  productId: string;
  requestHost?: string | null | undefined;
  stockedQuantity: number;
  tenantId?: string | null | undefined;
}): Promise<MerchantProductStockResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    getProductStockUrl({
      platformApiBaseUrl: options.platformApiBaseUrl,
      productId: options.productId,
      tenantId,
    }),
    {
      body: JSON.stringify({
        stockedQuantity: options.stockedQuantity,
      }),
      cache: "no-store",
      headers: getProductHeaders({
        cookieHeader: options.cookieHeader,
        contentType: true,
        requestHost: tenantId ? undefined : options.requestHost,
      }),
      method: "POST",
    },
  ).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseProductStockResponse(response);
}

export async function getMerchantProductVariantStock(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  productId: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
  variantId: string;
}): Promise<MerchantProductStockResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    getProductVariantStockUrl({
      platformApiBaseUrl: options.platformApiBaseUrl,
      productId: options.productId,
      tenantId,
      variantId: options.variantId,
    }),
    {
      cache: "no-store",
      headers: getProductHeaders({
        cookieHeader: options.cookieHeader,
        requestHost: tenantId ? undefined : options.requestHost,
      }),
    },
  ).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseProductStockResponse(response);
}

export async function updateMerchantProductVariantStock(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  productId: string;
  requestHost?: string | null | undefined;
  stockedQuantity: number;
  tenantId?: string | null | undefined;
  variantId: string;
}): Promise<MerchantProductStockResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    getProductVariantStockUrl({
      platformApiBaseUrl: options.platformApiBaseUrl,
      productId: options.productId,
      tenantId,
      variantId: options.variantId,
    }),
    {
      body: JSON.stringify({
        stockedQuantity: options.stockedQuantity,
      }),
      cache: "no-store",
      headers: getProductHeaders({
        cookieHeader: options.cookieHeader,
        contentType: true,
        requestHost: tenantId ? undefined : options.requestHost,
      }),
      method: "POST",
    },
  ).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseProductStockResponse(response);
}

export async function deleteMerchantProduct(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  productId: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantDeleteActionResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    getProductMutationUrl({
      platformApiBaseUrl: options.platformApiBaseUrl,
      productId: options.productId,
      tenantId,
    }),
    {
      cache: "no-store",
      headers: getProductHeaders({
        cookieHeader: options.cookieHeader,
        requestHost: tenantId ? undefined : options.requestHost,
      }),
      method: "DELETE",
    },
  ).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseDeleteResponse(response, "product");
}

export async function deleteMerchantProductsBatch(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  productIds: string[];
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantBatchDeleteActionResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const basePath = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/products`
    : "/platform/merchant/products";
  const url = new URL(`${basePath}/batch-delete`, normalizeBaseUrl(options.platformApiBaseUrl));

  const response = await fetcher(url, {
    body: JSON.stringify({ productIds: options.productIds }),
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      contentType: true,
      requestHost: tenantId ? undefined : options.requestHost,
    }),
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseBatchDeleteResponse(response);
}

export async function deleteMerchantProductCategory(options: {
  categoryId: string;
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantDeleteActionResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const basePath = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/product-categories`
    : "/platform/merchant/product-categories";
  const url = new URL(`${basePath}/${encodeURIComponent(options.categoryId)}`, normalizeBaseUrl(options.platformApiBaseUrl));

  const response = await fetcher(url, {
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: tenantId ? undefined : options.requestHost,
    }),
    method: "DELETE",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseDeleteResponse(response, "category");
}

export async function deleteMerchantProductCategoriesBatch(options: {
  categoryIds: string[];
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantBatchDeleteActionResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const basePath = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/product-categories`
    : "/platform/merchant/product-categories";
  const url = new URL(`${basePath}/batch-delete`, normalizeBaseUrl(options.platformApiBaseUrl));

  const response = await fetcher(url, {
    body: JSON.stringify({ categoryIds: options.categoryIds }),
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      contentType: true,
      requestHost: tenantId ? undefined : options.requestHost,
    }),
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseBatchDeleteResponse(response);
}

export async function deleteMerchantProductCollection(options: {
  collectionId: string;
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantDeleteActionResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const basePath = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/product-collections`
    : "/platform/merchant/product-collections";
  const url = new URL(`${basePath}/${encodeURIComponent(options.collectionId)}`, normalizeBaseUrl(options.platformApiBaseUrl));

  const response = await fetcher(url, {
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: tenantId ? undefined : options.requestHost,
    }),
    method: "DELETE",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseDeleteResponse(response, "collection");
}

export async function deleteMerchantProductCollectionsBatch(options: {
  collectionIds: string[];
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantBatchDeleteActionResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const basePath = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/product-collections`
    : "/platform/merchant/product-collections";
  const url = new URL(`${basePath}/batch-delete`, normalizeBaseUrl(options.platformApiBaseUrl));

  const response = await fetcher(url, {
    body: JSON.stringify({ collectionIds: options.collectionIds }),
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      contentType: true,
      requestHost: tenantId ? undefined : options.requestHost,
    }),
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseBatchDeleteResponse(response);
}

async function parseDeleteResponse(
  response: Response,
  resource: string,
): Promise<MerchantDeleteActionResult> {
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : response.statusText || `Failed to delete ${resource}.`,
    };
  }

  const parsed = merchantDeleteResultSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: `invalid_${resource}_delete_response`,
    };
  }

  return {
    ok: true,
    id: parsed.data.id,
    deleted: parsed.data.deleted,
  };
}

async function parseBatchDeleteResponse(
  response: Response,
): Promise<MerchantBatchDeleteActionResult> {
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : response.statusText || "Failed to batch delete resources.",
    };
  }

  const parsed = merchantBatchDeleteResultSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_batch_delete_response",
    };
  }

  return {
    ok: true,
    ids: parsed.data.ids,
    deleted: parsed.data.deleted,
  };
}

async function fetchProductResource(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  resource: "product-categories" | "product-collections";
  tenantId?: string | null | undefined;
}) {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getProductResourceUrl({ ...options, tenantId }), {
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: tenantId ? undefined : options.requestHost,
    }),
  }).catch(() => null);

  if (!response) {
    return {
      ok: false as const,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return response;
}

async function fetchProductStockResource(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  productId: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}) {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    getProductStockUrl({
      platformApiBaseUrl: options.platformApiBaseUrl,
      productId: options.productId,
      tenantId,
    }),
    {
      cache: "no-store",
      headers: getProductHeaders({
        cookieHeader: options.cookieHeader,
        requestHost: tenantId ? undefined : options.requestHost,
      }),
    },
  ).catch(() => null);

  if (!response) {
    return {
      ok: false as const,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return response;
}

async function sendProductMutation(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  product: MerchantProductWriteInput;
  productId?: string | undefined;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}) {
  const fetcher = options.fetcher ?? fetch;

  return fetcher(getProductMutationUrl(options), {
    body: JSON.stringify(options.product),
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      contentType: true,
      requestHost: options.tenantId?.trim() ? undefined : options.requestHost,
    }),
    method: "POST",
  });
}

async function sendTaxonomyMutation(options: {
  body: Record<string, string | null | undefined>;
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  resource: "product-categories" | "product-collections";
  tenantId?: string | null | undefined;
}) {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getProductResourceMutationUrl({ ...options, tenantId }), {
    body: JSON.stringify(options.body),
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      contentType: true,
      requestHost: tenantId ? undefined : options.requestHost,
    }),
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false as const,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return response;
}

async function parseProductResponse(response: Response): Promise<MerchantProductResult> {
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : response.statusText || "Product request failed",
    };
  }

  const parsed = merchantProductMutationSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_product_response",
    };
  }

  return {
    ok: true,
    product: parsed.data.product,
  };
}

async function parseProductMutationResponse(
  response: Response,
): Promise<MerchantProductMutationResult> {
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : response.statusText || "Product request failed",
    };
  }

  const parsed = merchantProductMutationSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_product_response",
    };
  }

  return {
    ok: true,
    product: parsed.data.product,
  };
}

async function parseProductStockResponse(
  response:
    | Response
    | {
        ok: false;
        message: string;
        status: number;
      },
): Promise<MerchantProductStockResult> {
  if (!(response instanceof Response)) {
    return response;
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: error.success
        ? error.data.error
        : response.statusText || "Product stock request failed",
    };
  }

  const parsed = merchantProductStockResponseSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_product_stock_response",
    };
  }

  return {
    ok: true,
    stock: parsed.data.stock,
  };
}

async function parseProductCategoryMutationResponse(
  response:
    | Response
    | {
        ok: false;
        message: string;
        status: number;
      },
): Promise<MerchantProductCategoryMutationResult> {
  if (!response.ok) {
    if (!(response instanceof Response)) {
      return response;
    }

    const data = await response.json().catch(() => undefined);
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message:
        error.success ? error.data.error : response.statusText || "Product category request failed",
    };
  }

  const data = await response.json().catch(() => undefined);
  const parsed = merchantProductCategorySchema.safeParse(
    typeof data === "object" && data !== null && "category" in data
      ? (data as { category?: unknown }).category
      : undefined,
  );

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_product_category_response",
    };
  }

  return {
    ok: true,
    category: parsed.data,
  };
}

async function parseProductCollectionMutationResponse(
  response:
    | Response
    | {
        ok: false;
        message: string;
        status: number;
      },
): Promise<MerchantProductCollectionMutationResult> {
  if (!response.ok) {
    if (!(response instanceof Response)) {
      return response;
    }

    const data = await response.json().catch(() => undefined);
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message:
        error.success
          ? error.data.error
          : response.statusText || "Product collection request failed",
    };
  }

  const data = await response.json().catch(() => undefined);
  const parsed = merchantProductCollectionSchema.safeParse(
    typeof data === "object" && data !== null && "collection" in data
      ? (data as { collection?: unknown }).collection
      : undefined,
  );

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_product_collection_response",
    };
  }

  return {
    ok: true,
    collection: parsed.data,
  };
}

async function parseProductCategoriesResponse(
  response:
    | Response
    | {
        ok: false;
        message: string;
        status: number;
      },
): Promise<MerchantProductCategoriesResult> {
  if (!response.ok) {
    if (!(response instanceof Response)) {
      return response;
    }

    const data = await response.json().catch(() => undefined);
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message:
        error.success ? error.data.error : response.statusText || "Product categories request failed",
    };
  }

  const data = await response.json().catch(() => undefined);
  const parsed = merchantProductCategoriesSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_product_categories_response",
    };
  }

  return {
    ok: true,
    ...parsed.data,
  };
}

async function parseProductCollectionsResponse(
  response:
    | Response
    | {
        ok: false;
        message: string;
        status: number;
      },
): Promise<MerchantProductCollectionsResult> {
  if (!response.ok) {
    if (!(response instanceof Response)) {
      return response;
    }

    const data = await response.json().catch(() => undefined);
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message:
        error.success
          ? error.data.error
          : response.statusText || "Product collections request failed",
    };
  }

  const data = await response.json().catch(() => undefined);
  const parsed = merchantProductCollectionsSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_product_collections_response",
    };
  }

  return {
    ok: true,
    ...parsed.data,
  };
}

function getProductsUrl(options: {
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  tenantId?: string | null | undefined;
}) {
  const path = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/products`
    : "/platform/merchant/products";
  const url = new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));

  if (typeof options.limit === "number") {
    url.searchParams.set("limit", String(options.limit));
  }

  if (typeof options.offset === "number") {
    url.searchParams.set("offset", String(options.offset));
  }

  return url;
}

function getProductResourceUrl(options: {
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  resource: "product-categories" | "product-collections";
  tenantId?: string | null | undefined;
}) {
  const path = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/${options.resource}`
    : `/platform/merchant/${options.resource}`;
  const url = new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));

  url.searchParams.set("limit", String(options.limit ?? 100));
  url.searchParams.set("offset", String(options.offset ?? 0));

  return url;
}

function getProductResourceMutationUrl(options: {
  platformApiBaseUrl: string;
  resource: "product-categories" | "product-collections";
  tenantId?: string | null | undefined;
}) {
  const path = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/${options.resource}`
    : `/platform/merchant/${options.resource}`;

  return new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));
}

function getProductMutationUrl(options: {
  platformApiBaseUrl: string;
  productId?: string | undefined;
  tenantId?: string | null | undefined;
}) {
  const basePath = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/products`
    : "/platform/merchant/products";
  const productPath = options.productId
    ? `${basePath}/${encodeURIComponent(options.productId)}`
    : basePath;

  return new URL(productPath, normalizeBaseUrl(options.platformApiBaseUrl));
}

function getProductStockUrl(options: {
  platformApiBaseUrl: string;
  productId: string;
  tenantId?: string | null | undefined;
}) {
  const basePath = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/products`
    : "/platform/merchant/products";

  return new URL(
    `${basePath}/${encodeURIComponent(options.productId)}/stock`,
    normalizeBaseUrl(options.platformApiBaseUrl),
  );
}

function getProductVariantStockUrl(options: {
  platformApiBaseUrl: string;
  productId: string;
  tenantId?: string | null | undefined;
  variantId: string;
}) {
  const basePath = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/products`
    : "/platform/merchant/products";

  return new URL(
    `${basePath}/${encodeURIComponent(options.productId)}/variants/${encodeURIComponent(
      options.variantId,
    )}/stock`,
    normalizeBaseUrl(options.platformApiBaseUrl),
  );
}

function getProductHeaders(options: {
  cookieHeader?: string | null | undefined;
  contentType?: boolean | undefined;
  requestHost?: string | null | undefined;
}) {
  return createPlatformHeaders({
    contentType: options.contentType ? "json" : false,
    cookieHeader: options.cookieHeader,
    requestHost: options.requestHost,
  });
}
