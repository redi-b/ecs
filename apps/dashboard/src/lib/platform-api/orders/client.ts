import type { MerchantOrder, MerchantOrders } from "@ecs/contracts";
import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";
import { merchantOrderSchema, merchantOrdersSchema, platformErrorSchema } from "@ecs/contracts";

export type MerchantOrderAction = "cancel" | "complete" | "deliver" | "fulfill";

export type MerchantOrdersResult =
  | {
      ok: true;
      orders: MerchantOrders;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantOrderResult =
  | {
      ok: true;
      order: MerchantOrder;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantOrderActionResult = MerchantOrderResult;

export async function getMerchantOrders(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantOrdersResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getOrdersUrl(options), {
    cache: "no-store",
    headers: getOrderHeaders({
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
      message: (error.success ? error.data.error : response.statusText || "Orders request failed"),
    };
  }

  const parsed = merchantOrdersSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_orders_response",
    };
  }

  return {
    ok: true,
    orders: parsed.data,
  };
}

export async function getMerchantOrder(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  orderId: string;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantOrderResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getOrderUrl(options), {
    cache: "no-store",
    headers: getOrderHeaders({
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
      message: (error.success ? error.data.error : response.statusText || "Order request failed"),
    };
  }

  const parsed = merchantOrderSchema.safeParse(data?.order);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_order_response",
    };
  }

  return {
    ok: true,
    order: parsed.data,
  };
}

export async function mutateMerchantOrder(options: {
  action: MerchantOrderAction;
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  fulfillmentId?: string | null | undefined;
  orderId: string;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantOrderActionResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getOrderActionUrl(options), {
    body: JSON.stringify({}),
    cache: "no-store",
    headers: getOrderHeaders({
      contentType: "application/json",
      cookieHeader: options.cookieHeader,
      requestHost: options.tenantId?.trim() ? undefined : options.requestHost,
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

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: (error.success ? error.data.error : response.statusText || "Order action failed"),
    };
  }

  const parsed = merchantOrderSchema.safeParse(data?.order);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_order_response",
    };
  }

  return {
    ok: true,
    order: parsed.data,
  };
}

function getOrdersUrl(options: {
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  tenantId?: string | null | undefined;
}) {
  const path = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/orders`
    : "/platform/merchant/orders";
  const url = new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));

  if (typeof options.limit === "number") {
    url.searchParams.set("limit", String(options.limit));
  }

  if (typeof options.offset === "number") {
    url.searchParams.set("offset", String(options.offset));
  }

  return url;
}

function getOrderUrl(options: {
  orderId: string;
  platformApiBaseUrl: string;
  tenantId?: string | null | undefined;
}) {
  const tenantId = options.tenantId?.trim();
  const encodedOrderId = encodeURIComponent(options.orderId);
  const path = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/orders/${encodedOrderId}`
    : `/platform/merchant/orders/${encodedOrderId}`;

  return new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));
}

function getOrderActionUrl(options: {
  action: MerchantOrderAction;
  fulfillmentId?: string | null | undefined;
  orderId: string;
  platformApiBaseUrl: string;
  tenantId?: string | null | undefined;
}) {
  const tenantId = options.tenantId?.trim();
  const encodedOrderId = encodeURIComponent(options.orderId);
  const basePath = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/orders/${encodedOrderId}`
    : `/platform/merchant/orders/${encodedOrderId}`;
  const path =
    options.action === "deliver"
      ? `${basePath}/fulfillments/${encodeURIComponent(options.fulfillmentId ?? "")}/deliver`
      : `${basePath}/${options.action}`;

  return new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));
}

function getOrderHeaders(options: {
  contentType?: string | undefined;
  cookieHeader?: string | null | undefined;
  requestHost?: string | null | undefined;
}) {
  return createPlatformHeaders({
    contentType: options.contentType || false,
    cookieHeader: options.cookieHeader,
    requestHost: options.requestHost,
  });
}
