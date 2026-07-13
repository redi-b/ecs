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
    shippingOptionId?: string | undefined;
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

  async function postFulfillment(payload: Record<string, unknown>) {
    return requestMedusa(fetcher, getOrderFulfillmentUrl(options.medusaInternalUrl, input), {
      body: JSON.stringify(payload),
      headers: getAdminHeaders(options.adminApiToken ?? ""),
      method: "POST",
    });
  }

  const shippingOptionId = input.shippingOptionId?.trim();
  const basePayload: Record<string, unknown> = {
    items,
    location_id: input.stockLocationId,
    metadata: {
      source: "platform",
    },
  };
  // Shipping option ties the fulfillment to the same shipping profile as the
  // order lines / tenant delivery option — avoids profile mismatch 400s.
  if (shippingOptionId) {
    basePayload.shipping_option_id = shippingOptionId;
  }

  let response = await postFulfillment(basePayload);

  // Retry without location when Medusa rejects profile/location pairing.
  // Option-only fulfill lets Medusa pick a location that matches the profile.
  if (!response.ok && response.status === 400 && shippingOptionId) {
    response = await postFulfillment({
      items,
      shipping_option_id: shippingOptionId,
      metadata: { source: "platform" },
    });
  }

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
    // Surface Medusa validation (e.g. shipping profile mismatch) as not fulfillable
    // so the dashboard can show a recoverable merchant message.
    if (response.status === 400) {
      return {
        ok: false,
        error: "order_not_fulfillable",
        status: 409,
      };
    }
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  // Fulfillment create may not embed a full order — re-fetch for fulfillments + line items.
  return getMerchantOrderForAction(fetcher, options, {
    orderId: input.orderId,
    salesChannelId: input.salesChannelId,
  });
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

  return getMerchantOrderForAction(fetcher, options, {
    orderId: input.orderId,
    salesChannelId: input.salesChannelId,
  });
}
