import type {
  MerchantOrderAction,
  MerchantOrderActionResult,
  MerchantOrderDetailResult,
  MerchantOrdersResult,
} from "../../../types/index.js";
import {
  deliverMerchantOrderFulfillment,
  fulfillMerchantOrder,
  getMerchantOrderForAction,
} from "./actions.js";
import { getAdminHeaders, missingCredentials, requestMedusa } from "./medusa-http.js";
import { normalizeOrder } from "./normalize.js";
import { getOrderActionUrl, getOrdersUrl, getOrderUrl } from "./urls.js";
import { getNumber } from "./values.js";

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
    },

    mutateMerchantOrder: async (input: {
      action: MerchantOrderAction;
      fulfillmentId?: string | undefined;
      orderId: string;
      salesChannelId: string;
      stockLocationId?: string | undefined;
    }): Promise<MerchantOrderActionResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const existing = await getMerchantOrderForAction(fetcher, options, input);

      if (!existing.ok) {
        return existing;
      }

      if (input.action === "fulfill") {
        return fulfillMerchantOrder(fetcher, options, {
          ...input,
          order: existing.order,
        });
      }

      if (input.action === "deliver") {
        return deliverMerchantOrderFulfillment(fetcher, options, {
          ...input,
          order: existing.order,
        });
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

      // complete/cancel responses often omit sales_channel_id / nested fields.
      // Always re-fetch a full merchant-normalized order after a successful action.
      const refreshed = await getMerchantOrderForAction(fetcher, options, input);
      if (refreshed.ok) {
        return refreshed;
      }

      // Action succeeded on Medusa; if re-fetch races, return prior order with status hint.
      return {
        ok: true,
        order: {
          ...existing.order,
          status:
            input.action === "complete"
              ? "completed"
              : input.action === "cancel"
                ? "canceled"
                : existing.order.status,
        },
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
          error: "commerce_credentials_invalid",
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
