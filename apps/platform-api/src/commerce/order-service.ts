import type { MerchantOrder, MerchantOrdersResult } from "../app.js";

export function createMedusaOrderService(options: {
  adminApiToken?: string | undefined;
  fetcher?: typeof fetch;
  medusaInternalUrl: string;
}) {
  const fetcher = options.fetcher ?? fetch;

  return {
    listMerchantOrders: async (input: {
      limit: number;
      offset: number;
      salesChannelId: string;
    }): Promise<MerchantOrdersResult> => {
      if (!options.adminApiToken?.trim()) {
        return {
          ok: false,
          error: "commerce_credentials_missing",
          status: 503,
        };
      }

      let response: Response;

      try {
        response = await fetcher(getOrdersUrl(options.medusaInternalUrl, input), {
          headers: {
            accept: "application/json",
            "x-medusa-access-token": options.adminApiToken,
          },
        });
      } catch {
        return {
          ok: false,
          error: "commerce_backend_unavailable",
          status: 503,
        };
      }

      if (response.status === 401) {
        return {
          ok: false,
          error: "commerce_credentials_missing",
          status: 401,
        };
      }

      if (!response.ok) {
        return {
          ok: false,
          error: "commerce_backend_unavailable",
          status: 503,
        };
      }

      const data = await response.json().catch(() => undefined);
      const orders = Array.isArray(data?.orders)
        ? data.orders.flatMap((order: unknown) => normalizeOrder(order, input.salesChannelId))
        : [];

      return {
        ok: true,
        count: orders.length,
        limit: getNumber(data?.limit) ?? input.limit,
        offset: getNumber(data?.offset) ?? input.offset,
        orders,
      };
    },
  };
}

function getOrdersUrl(
  medusaInternalUrl: string,
  input: { limit: number; offset: number; salesChannelId: string },
) {
  const url = new URL("/admin/orders", normalizeBaseUrl(medusaInternalUrl));

  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("offset", String(input.offset));
  url.searchParams.set("order", "-created_at");
  url.searchParams.set(
    "fields",
    "id,display_id,email,status,payment_status,fulfillment_status,currency_code,total,sales_channel_id,created_at,updated_at",
  );

  return url;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeOrder(value: unknown, salesChannelId: string): MerchantOrder[] {
  if (!isRecord(value) || value.sales_channel_id !== salesChannelId) {
    return [];
  }

  const id = getString(value.id);

  if (!id) {
    return [];
  }

  return [
    {
      id,
      displayId: getNumber(value.display_id) ?? null,
      email: getString(value.email),
      status: getString(value.status),
      paymentStatus: getString(value.payment_status),
      fulfillmentStatus: getString(value.fulfillment_status),
      currencyCode: getString(value.currency_code),
      total: getNumber(value.total) ?? null,
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
    },
  ];
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
