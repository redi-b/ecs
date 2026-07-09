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
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import type {
  MerchantBatchDeleteActionResult,
  MerchantDeleteActionResult,
  MerchantProductCategoriesResult,
  MerchantProductCategoryMutationResult,
  MerchantProductCollectionMutationResult,
  MerchantProductCollectionsResult,
  MerchantProductMutationResult,
  MerchantProductResult,
  MerchantProductStockResult,
  MerchantProductWriteInput,
  MerchantProductsResult,
} from "./types";
import {
  getProductHeaders,
  getProductMutationUrl,
  getProductResourceMutationUrl,
  getProductResourceUrl,
  getProductStockUrl,
  getProductVariantStockUrl,
  getProductsUrl,
} from "./urls";


export async function parseDeleteResponse(
  response: Response,
  resource: string,
): Promise<MerchantDeleteActionResult> {
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      status: response.status,
      message: mapPlatformErrorMessage(error.success ? error.data.error : undefined, { fallback: response.statusText || `Failed to delete ${resource}.`, resource: "Catalog data" }),
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

export async function parseBatchDeleteResponse(
  response: Response,
): Promise<MerchantBatchDeleteActionResult> {
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      status: response.status,
      message: mapPlatformErrorMessage(error.success ? error.data.error : undefined, { fallback: response.statusText || "Failed to batch delete resources.", resource: "Catalog data" }),
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

export async function fetchProductResource(options: {
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

export async function fetchProductStockResource(options: {
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

export async function sendProductMutation(options: {
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

export async function sendTaxonomyMutation(options: {
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

export async function parseProductResponse(response: Response): Promise<MerchantProductResult> {
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: mapPlatformErrorMessage(error.success ? error.data.error : undefined, { fallback: response.statusText || "Product request failed", resource: "Catalog data" }),
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

export async function parseProductMutationResponse(
  response: Response,
): Promise<MerchantProductMutationResult> {
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: mapPlatformErrorMessage(error.success ? error.data.error : undefined, { fallback: response.statusText || "Product request failed", resource: "Catalog data" }),
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

export async function parseProductStockResponse(
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

export async function parseProductCategoryMutationResponse(
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
        mapPlatformErrorMessage(error.success ? error.data.error : undefined, { fallback: response.statusText || "Product category request failed", resource: "Catalog data" }),
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

export async function parseProductCollectionMutationResponse(
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

export async function parseProductCategoriesResponse(
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
        mapPlatformErrorMessage(error.success ? error.data.error : undefined, { fallback: response.statusText || "Product categories request failed", resource: "Catalog data" }),
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

export async function parseProductCollectionsResponse(
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

