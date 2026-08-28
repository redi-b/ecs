import { fetchProductStockResource, parseProductStockResponse } from "./shared";
import type { MerchantProductStockResult } from "./types";
import {
  getBulkInventoryUrl,
  getProductHeaders,
  getProductStockUrl,
  getProductVariantStockUrl,
} from "./urls";

export type BulkInventoryUpdate = {
  productId: string;
  variantId: string;
  stockedQuantity: number;
};

export type BulkInventoryActionResult =
  | {
      ok: true;
      failed: number;
      results: Array<BulkInventoryUpdate & { ok: boolean; error?: string }>;
      succeeded: number;
    }
  | { ok: false; message: string; status: number };

export async function updateMerchantInventoryBatch(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  updates: BulkInventoryUpdate[];
}): Promise<BulkInventoryActionResult> {
  const response = await (options.fetcher ?? fetch)(
    getBulkInventoryUrl(options.platformApiBaseUrl),
    {
      body: JSON.stringify({ updates: options.updates }),
      cache: "no-store",
      headers: getProductHeaders({
        cookieHeader: options.cookieHeader,
        contentType: true,
        requestHost: options.requestHost,
      }),
      method: "POST",
    },
  ).catch(() => null);
  if (!response) return { ok: false, message: "platform_request_failed", status: 503 };
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return {
      ok: false,
      message: typeof data?.error === "string" ? data.error : "inventory_batch_update_failed",
      status: response.status,
    };
  }
  if (
    typeof data?.succeeded !== "number" ||
    typeof data?.failed !== "number" ||
    !Array.isArray(data?.results)
  ) {
    return { ok: false, message: "invalid_inventory_batch_response", status: 502 };
  }
  return {
    ok: true,
    succeeded: data.succeeded,
    failed: data.failed,
    results: data.results,
  };
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
