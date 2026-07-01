import type {
  MerchantOrder,
  MerchantOrderAction,
  MerchantOrderActionResult,
  MerchantOrderDetailResult,
  MerchantOrdersResult,
} from "../app.js";

export function createMedusaOrderService(options: {
  adminApiToken?: string | undefined;
  fetcher?: typeof fetch;
  medusaInternalUrl: string;
}) {
  const fetcher = options.fetcher ?? fetch;

  return {
    getMerchantOrder: async (input: {
      orderId: string;
      salesChannelId: string;
    }): Promise<MerchantOrderDetailResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const response = await requestMedusa(fetcher, getOrderUrl(options.medusaInternalUrl, input), {
        headers: getAdminHeaders(options.adminApiToken),
      });

      if (response.status === 401) {
        return {
          ok: false,
          error: "commerce_credentials_missing",
          status: 401,
        };
      }

      if (response.status === 404) {
        return {
          ok: false,
          error: "order_not_found",
          status: 404,
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
      const order = normalizeOrder(data?.order, input.salesChannelId)[0];

      if (!order) {
        return {
          ok: false,
          error: "order_not_found",
          status: 404,
        };
      }

      return {
        ok: true,
        order,
      };
    },

    mutateMerchantOrder: async (input: {
      action: MerchantOrderAction;
      orderId: string;
      salesChannelId: string;
    }): Promise<MerchantOrderActionResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const existing = await getMerchantOrderForAction(fetcher, options, input);

      if (!existing.ok) {
        return existing;
      }

      const response = await requestMedusa(
        fetcher,
        getOrderActionUrl(options.medusaInternalUrl, input),
        {
          ...(input.action === "complete" ? { body: JSON.stringify({}) } : {}),
          headers: getAdminHeaders(options.adminApiToken),
          method: "POST",
        },
      );

      if (response.status === 401) {
        return {
          ok: false,
          error: "commerce_credentials_missing",
          status: 401,
        };
      }

      if (response.status === 404) {
        return {
          ok: false,
          error: "order_not_found",
          status: 404,
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
      const order = normalizeOrder(data?.order, input.salesChannelId)[0];

      if (!order) {
        return {
          ok: false,
          error: "order_not_found",
          status: 404,
        };
      }

      return {
        ok: true,
        order,
      };
    },

    listMerchantOrders: async (input: {
      limit: number;
      offset: number;
      salesChannelId: string;
    }): Promise<MerchantOrdersResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const response = await requestMedusa(
        fetcher,
        getOrdersUrl(options.medusaInternalUrl, input),
        {
          headers: getAdminHeaders(options.adminApiToken),
        },
      );

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

async function requestMedusa(fetcher: typeof fetch, input: URL, init: RequestInit) {
  try {
    return await fetcher(input, init);
  } catch {
    return Response.json({}, { status: 503 });
  }
}

function getAdminHeaders(adminApiToken: string) {
  return {
    accept: "application/json",
    "x-medusa-access-token": adminApiToken,
  };
}

function missingCredentials() {
  return {
    ok: false,
    error: "commerce_credentials_missing",
    status: 503,
  } as const;
}

async function getMerchantOrderForAction(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: { orderId: string; salesChannelId: string },
): Promise<MerchantOrderDetailResult> {
  const response = await requestMedusa(fetcher, getOrderUrl(options.medusaInternalUrl, input), {
    headers: getAdminHeaders(options.adminApiToken ?? ""),
  });

  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_missing",
      status: 401,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: "order_not_found",
      status: 404,
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
  const order = normalizeOrder(data?.order, input.salesChannelId)[0];

  if (!order) {
    return {
      ok: false,
      error: "order_not_found",
      status: 404,
    };
  }

  return {
    ok: true,
    order,
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

function getOrderUrl(
  medusaInternalUrl: string,
  input: { orderId: string; salesChannelId: string },
) {
  const url = new URL(
    `/admin/orders/${encodeURIComponent(input.orderId)}`,
    normalizeBaseUrl(medusaInternalUrl),
  );

  url.searchParams.set(
    "fields",
    "id,display_id,email,status,payment_status,fulfillment_status,currency_code,total,sales_channel_id,items.id,items.title,items.quantity,items.unit_price,items.total,items.thumbnail,created_at,updated_at",
  );

  return url;
}

function getOrderActionUrl(
  medusaInternalUrl: string,
  input: { action: MerchantOrderAction; orderId: string },
) {
  return new URL(
    `/admin/orders/${encodeURIComponent(input.orderId)}/${input.action}`,
    normalizeBaseUrl(medusaInternalUrl),
  );
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
      items: getLineItems(value.items),
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
    },
  ];
}

function getLineItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const id = getString(item.id);

    if (!id) {
      return [];
    }

    return [
      {
        id,
        title: getString(item.title),
        quantity: getNumber(item.quantity) ?? null,
        unitPrice: getNumber(item.unit_price) ?? null,
        total: getNumber(item.total) ?? null,
        thumbnail: getString(item.thumbnail),
      },
    ];
  });
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
