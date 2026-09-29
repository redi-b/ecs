import {
  type MerchantInventoryMovement,
  type MerchantInventoryMovementReason,
  merchantInventoryMovementsResponseSchema,
  platformErrorSchema,
} from "@ecs/contracts";
import { fetchProductStockResource, parseProductStockResponse } from "./shared";
import type { MerchantProductStockResult } from "./types";
import {
  getBulkInventoryUrl,
  getProductHeaders,
  getProductInventoryMovementsUrl,
  getProductStockUrl,
  getProductVariantStockUrl,
} from "./urls";

export type MerchantInventoryMovementsResult =
  | {
      ok: true;
      count: number;
      limit: number;
      movements: MerchantInventoryMovement[];
      offset: number;
    }
  | { ok: false; message: string; status: number };

export async function listMerchantInventoryMovements(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  productId: string;
  requestHost?: string | null | undefined;
  variantId?: string | undefined;
}): Promise<MerchantInventoryMovementsResult> {
  const response = await (options.fetcher ?? fetch)(getProductInventoryMovementsUrl(options), {
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: options.requestHost,
    }),
  }).catch(() => null);
  if (!response) return { ok: false, message: "platform_request_failed", status: 503 };
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      message: error.success ? error.data.error : "inventory_movements_request_failed",
      status: response.status,
    };
  }
  const parsed = merchantInventoryMovementsResponseSchema.safeParse(data);
  return parsed.success
    ? { ok: true, ...parsed.data }
    : { ok: false, message: "invalid_inventory_movements_response", status: 502 };
}

export type BulkInventoryUpdate = {
  productId: string;
  variantId: string;
  stockedQuantity: number;
  reason?: MerchantInventoryMovementReason | undefined;
  note?: string | undefined;
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
  idempotencyKey: string;
  requestHost?: string | null | undefined;
  updates: BulkInventoryUpdate[];
}): Promise<BulkInventoryActionResult> {
  const response = await (options.fetcher ?? fetch)(
    getBulkInventoryUrl(options.platformApiBaseUrl),
    {
      body: JSON.stringify({ updates: options.updates }),
      cache: "no-store",
      headers: withIdempotencyKey(
        getProductHeaders({
          cookieHeader: options.cookieHeader,
          contentType: true,
          requestHost: options.requestHost,
        }),
        options.idempotencyKey,
      ),
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
  idempotencyKey: string;
  productId: string;
  requestHost?: string | null | undefined;
  stockedQuantity: number;
  reason?: MerchantInventoryMovementReason | undefined;
  note?: string | undefined;
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
        note: options.note,
        reason: options.reason ?? "manual_count",
        stockedQuantity: options.stockedQuantity,
      }),
      cache: "no-store",
      headers: withIdempotencyKey(
        getProductHeaders({
          cookieHeader: options.cookieHeader,
          contentType: true,
          requestHost: tenantId ? undefined : options.requestHost,
        }),
        options.idempotencyKey,
      ),
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
  idempotencyKey: string;
  productId: string;
  requestHost?: string | null | undefined;
  stockedQuantity: number;
  reason?: MerchantInventoryMovementReason | undefined;
  note?: string | undefined;
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
        note: options.note,
        reason: options.reason ?? "manual_count",
        stockedQuantity: options.stockedQuantity,
      }),
      cache: "no-store",
      headers: withIdempotencyKey(
        getProductHeaders({
          cookieHeader: options.cookieHeader,
          contentType: true,
          requestHost: tenantId ? undefined : options.requestHost,
        }),
        options.idempotencyKey,
      ),
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

function withIdempotencyKey(headers: Headers, idempotencyKey: string) {
  headers.set("idempotency-key", idempotencyKey);
  return headers;
}
