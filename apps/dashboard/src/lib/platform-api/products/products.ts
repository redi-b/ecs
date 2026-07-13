import { merchantProductsSchema, platformErrorSchema } from "@ecs/contracts";
import { normalizeBaseUrl } from "@/lib/platform-api/client";
import {
  parseBatchDeleteResponse,
  parseDeleteResponse,
  parseProductMutationResponse,
  parseProductResponse,
  sendProductMutation,
} from "./shared";
import type {
  MerchantBatchDeleteActionResult,
  MerchantDeleteActionResult,
  MerchantProductMutationResult,
  MerchantProductResult,
  MerchantProductsResult,
  MerchantProductWriteInput,
} from "./types";
import { getProductHeaders, getProductMutationUrl, getProductsUrl } from "./urls";

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

export async function getMerchantProducts(options: {
  categoryId?: string | undefined;
  collectionId?: string | undefined;
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  q?: string | undefined;
  requestHost?: string | null | undefined;
  status?: string | undefined;
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
