import type {
  MerchantOrder,
  MerchantOrderAction,
  MerchantOrderActionResult,
  MerchantOrderDetailResult,
  MerchantOrderListQuery,
  MerchantOrdersResult,
} from "../../../types/index.js";
import {
  deliverMerchantOrderFulfillment,
  fulfillMerchantOrder,
  getMerchantOrderForAction,
} from "./actions.js";
import {
  applyOrderListPostFilters,
  needsPostFilter,
} from "./list-query.js";
import { getAdminHeaders, missingCredentials, requestMedusa } from "./medusa-http.js";
import { normalizeOrder } from "./normalize.js";
import {
  capturePaymentByTxRef,
  finishMerchantOrder,
  markMerchantOrderPaid,
} from "./payment-actions.js";
import { getOrderActionUrl, getOrdersUrl, getOrderUrl } from "./urls.js";
import { getNumber } from "./values.js";

const POST_FILTER_SCAN_LIMIT = 500;
const POST_FILTER_PAGE_SIZE = 50;

export function createMedusaOrderService(options: {
  adminApiToken?: string | undefined;
  fetcher?: typeof fetch;
  medusaInternalUrl: string;
}) {
  const fetcher = options.fetcher ?? fetch;

  async function fetchOrderPage(
    input: MerchantOrderListQuery,
  ): Promise<
    | { ok: true; orders: MerchantOrder[]; count: number; limit: number; offset: number }
    | {
        ok: false;
        error:
          | "commerce_backend_unavailable"
          | "commerce_credentials_invalid"
          | "commerce_credentials_missing";
        status: 401 | 503;
      }
  > {
    if (!options.adminApiToken?.trim()) {
      return missingCredentials();
    }

    const response = await requestMedusa(fetcher, getOrdersUrl(options.medusaInternalUrl, input), {
      headers: getAdminHeaders(options.adminApiToken),
    });

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
      count: getNumber(data?.count) ?? orders.length,
      limit: getNumber(data?.limit) ?? input.limit,
      offset: getNumber(data?.offset) ?? input.offset,
      orders,
    };
  }

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

    markMerchantOrderPaid: async (input: {
      orderId: string;
      paymentReference?: string | null | undefined;
      salesChannelId: string;
      source?: "dashboard" | "chapa_webhook" | "chapa_recheck" | undefined;
    }): Promise<MerchantOrderActionResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }
      return markMerchantOrderPaid(fetcher, options, input);
    },

    capturePaymentByTxRef: async (input: {
      salesChannelId: string;
      source?: "chapa_webhook" | "chapa_recheck" | undefined;
      txRef: string;
    }): Promise<MerchantOrderActionResult | { ok: false; error: "order_not_found"; status: 404 }> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }
      return capturePaymentByTxRef(fetcher, options, input);
    },

    finishMerchantOrder: async (input: {
      markPaid?: boolean | undefined;
      orderId: string;
      salesChannelId: string;
      stockLocationId?: string | undefined;
    }): Promise<MerchantOrderActionResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }
      return finishMerchantOrder(fetcher, options, input);
    },

    mutateMerchantOrder: async (input: {
      action: MerchantOrderAction;
      fulfillmentId?: string | undefined;
      markPaid?: boolean | undefined;
      orderId: string;
      salesChannelId: string;
      shippingOptionId?: string | undefined;
      stockLocationId?: string | undefined;
    }): Promise<MerchantOrderActionResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      if (input.action === "mark-paid") {
        return markMerchantOrderPaid(fetcher, options, {
          orderId: input.orderId,
          salesChannelId: input.salesChannelId,
          source: "dashboard",
        });
      }

      if (input.action === "finish") {
        return finishMerchantOrder(fetcher, options, {
          markPaid: input.markPaid,
          orderId: input.orderId,
          salesChannelId: input.salesChannelId,
          shippingOptionId: input.shippingOptionId,
          stockLocationId: input.stockLocationId,
        });
      }

      if (input.action === "recheck-payment") {
        // Recheck without Chapa verify requires a reference; callers use dedicated route.
        return {
          ok: false,
          error: "order_not_fulfillable",
          status: 409,
        };
      }

      const existing = await getMerchantOrderForAction(fetcher, options, input);

      if (!existing.ok) {
        return existing;
      }

      if (input.action === "fulfill") {
        return fulfillMerchantOrder(fetcher, options, {
          order: existing.order,
          orderId: input.orderId,
          salesChannelId: input.salesChannelId,
          shippingOptionId: input.shippingOptionId,
          stockLocationId: input.stockLocationId,
        });
      }

      if (input.action === "deliver") {
        return deliverMerchantOrderFulfillment(fetcher, options, {
          ...input,
          order: existing.order,
        });
      }

      if (input.action !== "cancel" && input.action !== "complete") {
        return {
          ok: false,
          error: "order_not_fulfillable",
          status: 409,
        };
      }

      const response = await requestMedusa(
        fetcher,
        getOrderActionUrl(options.medusaInternalUrl, {
          action: input.action,
          orderId: input.orderId,
        }),
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

    listMerchantOrders: async (input: MerchantOrderListQuery): Promise<MerchantOrdersResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      // Lightweight path: Medusa pagination + channel normalize + soft post-filter.
      if (!needsPostFilter(input)) {
        const page = await fetchOrderPage(input);
        if (!page.ok) {
          return page;
        }

        // paymentStatus already on Medusa query; still belt-and-suspenders for channel-only edges.
        const orders = applyOrderListPostFilters(page.orders, input);

        return {
          ok: true,
          // Prefer Medusa total when we are not dropping rows via post-filters.
          count: orders.length === page.orders.length ? page.count : orders.length,
          limit: input.limit,
          offset: input.offset,
          orders,
        };
      }

      // Progress / method / delivery / free-text need post-filtering. Scan a bounded
      // window so page results are full and count is honest within that window.
      const matched: MerchantOrder[] = [];
      let scanOffset = 0;
      let exhausted = false;

      while (matched.length < input.offset + input.limit && scanOffset < POST_FILTER_SCAN_LIMIT) {
        const page = await fetchOrderPage({
          ...input,
          // Keep Medusa-side payment/date filters. Do NOT send free-text `q` to Medusa —
          // its search misses shop order codes (last-6) and several local fields; we match
          // those in applyOrderListPostFilters after scanning the sales channel window.
          q: undefined,
          // progress / method / delivery are derived labels — post-filter only.
          progress: undefined,
          paymentMethod: undefined,
          delivery: undefined,
          limit: POST_FILTER_PAGE_SIZE,
          offset: scanOffset,
        });

        if (!page.ok) {
          return page;
        }

        matched.push(...applyOrderListPostFilters(page.orders, input));

        if (page.orders.length < POST_FILTER_PAGE_SIZE) {
          exhausted = true;
          break;
        }

        scanOffset += POST_FILTER_PAGE_SIZE;

        // If Medusa returned fewer than requested total window, stop.
        if (scanOffset >= page.count) {
          exhausted = true;
          break;
        }
      }

      if (!exhausted && scanOffset >= POST_FILTER_SCAN_LIMIT) {
        exhausted = true;
      }

      const orders = matched.slice(input.offset, input.offset + input.limit);

      return {
        ok: true,
        count: matched.length,
        limit: input.limit,
        offset: input.offset,
        orders,
      };
    },
  };
}
