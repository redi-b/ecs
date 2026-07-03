import type {
  MerchantProduct,
  MerchantProductCategories,
  MerchantProductCollections,
  MerchantProducts,
} from "@ecs/contracts";
import {
  merchantProductCategoriesSchema,
  merchantProductCollectionsSchema,
  merchantProductMutationSchema,
  merchantProductsSchema,
  platformErrorSchema,
} from "@ecs/contracts";

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

export type MerchantProductWriteInput = {
  categoryIds?: string[] | undefined;
  collectionId?: string | null | undefined;
  currencyCode?: string | null | undefined;
  description?: string | null | undefined;
  handle?: string | null | undefined;
  imageUrls?: string[] | undefined;
  priceAmount?: number | undefined;
  status?: string | null | undefined;
  thumbnail?: string | null | undefined;
  title?: string | null | undefined;
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
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getProductResourceUrl(options), {
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: options.tenantId?.trim() ? undefined : options.requestHost,
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

function getProductHeaders(options: {
  cookieHeader?: string | null | undefined;
  contentType?: boolean | undefined;
  requestHost?: string | null | undefined;
}) {
  const headers = new Headers();

  if (options.contentType) {
    headers.set("accept", "application/json");
    headers.set("content-type", "application/json");
  }

  if (options.cookieHeader?.trim()) {
    headers.set("cookie", options.cookieHeader.trim());
  }

  if (options.requestHost?.trim()) {
    headers.set("x-forwarded-host", options.requestHost.trim());
  }

  return headers;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
