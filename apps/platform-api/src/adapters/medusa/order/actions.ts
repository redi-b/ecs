import type {
  MerchantOrder,
  MerchantOrderActionResult,
  MerchantOrderDetailResult,
} from "../../../types/index.js";
import { getAdminHeaders, missingCredentials, requestMedusa } from "./medusa-http.js";
import { getFulfillmentItems, normalizeOrder } from "./normalize.js";
import {
  getOrderActionUrl,
  getOrderFulfillmentDeliveryUrl,
  getOrderFulfillmentUrl,
  getOrderUrl,
} from "./urls.js";

export async function getMerchantOrderForAction(
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
      error: "commerce_credentials_invalid",
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

export async function fulfillMerchantOrder(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: {
    order: MerchantOrder;
    orderId: string;
    salesChannelId: string;
    stockLocationId?: string | undefined;
  },
): Promise<MerchantOrderActionResult> {
  if (!input.stockLocationId?.trim()) {
    return {
      ok: false,
      error: "inventory_location_unavailable",
      status: 503,
    };
  }

  const items = getFulfillmentItems(input.order);

  if (items.length === 0) {
    return {
      ok: false,
      error: "order_not_fulfillable",
      status: 409,
    };
  }

  const response = await requestMedusa(
    fetcher,
    getOrderFulfillmentUrl(options.medusaInternalUrl, input),
    {
      body: JSON.stringify({
        items,
        location_id: input.stockLocationId,
        metadata: {
          source: "platform",
        },
      }),
      headers: getAdminHeaders(options.adminApiToken ?? ""),
      method: "POST",
    },
  );

  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
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

  if (response.status === 409) {
    return {
      ok: false,
      error: "order_not_fulfillable",
      status: 409,
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

export async function deliverMerchantOrderFulfillment(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: {
    fulfillmentId?: string | undefined;
    order: MerchantOrder;
    orderId: string;
    salesChannelId: string;
  },
): Promise<MerchantOrderActionResult> {
  const fulfillmentId = input.fulfillmentId?.trim();

  if (
    !fulfillmentId ||
    !input.order.fulfillments?.some((fulfillment) => fulfillment.id === fulfillmentId)
  ) {
    return {
      ok: false,
      error: "order_fulfillment_not_found",
      status: 404,
    };
  }

  const response = await requestMedusa(
    fetcher,
    getOrderFulfillmentDeliveryUrl(options.medusaInternalUrl, {
      fulfillmentId,
      orderId: input.orderId,
    }),
    {
      body: JSON.stringify({}),
      headers: getAdminHeaders(options.adminApiToken ?? ""),
      method: "POST",
    },
  );

  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: "order_fulfillment_not_found",
      status: 404,
    };
  }

  if (response.status === 409) {
    return {
      ok: false,
      error: "order_not_fulfillable",
      status: 409,
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
