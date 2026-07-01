import type { MerchantOrders } from "@ecs/contracts";
import { merchantOrdersSchema, platformErrorSchema } from "@ecs/contracts";

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
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : response.statusText || "Orders request failed",
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

function getOrderHeaders(options: {
  cookieHeader?: string | null | undefined;
  requestHost?: string | null | undefined;
}) {
  const headers = new Headers();

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
