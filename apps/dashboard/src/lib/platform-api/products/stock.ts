import type { MerchantProductStockResult } from "./types.js";
import { fetchProductStockResource, parseProductStockResponse } from "./shared.js";
import {
  getProductHeaders,
  getProductStockUrl,
  getProductVariantStockUrl,
} from "./urls.js";

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

