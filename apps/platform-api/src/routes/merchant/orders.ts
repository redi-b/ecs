import type { Context, Hono } from "hono";
import type { MerchantOrderAction, PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { parseMerchantOrderListQuery } from "../../adapters/medusa/order/list-query.js";
import {
  buildOrderCancelledPayload,
  buildPaymentPaidPayload,
} from "../../modules/notifications/order-payload.js";
import { getPaginationValue, getRequestHost, storeErrorStatus } from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";

export function registerMerchantOrderRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const { getAuthorizedMerchantContext, getResolvedCommerce } = helpers;

  app.get("/platform/merchant/orders", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const commerce = getResolvedCommerce(result.context);

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.listMerchantOrders) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const orders = await options.listMerchantOrders(
      parseMerchantOrderListQuery(
        {
          created: context.req.query("created"),
          createdFrom: context.req.query("createdFrom"),
          createdTo: context.req.query("createdTo"),
          delivery: context.req.query("delivery"),
          method: context.req.query("method"),
          payment: context.req.query("payment"),
          paymentMethod: context.req.query("paymentMethod"),
          paymentStatus: context.req.query("paymentStatus"),
          progress: context.req.query("progress"),
          q: context.req.query("q"),
        },
        {
          limit: getPaginationValue(context.req.query("limit"), 20, 100),
          offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
          salesChannelId: commerce.context.medusaSalesChannelId,
        },
      ),
    );

    if (!orders.ok) {
      return context.json({ error: orders.error }, orders.status);
    }

    return context.json({
      orders: orders.orders,
      count: orders.count,
      limit: orders.limit,
      offset: orders.offset,
    });
  });

  app.get("/platform/merchant/orders/:orderId", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const commerce = getResolvedCommerce(result.context);

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.getMerchantOrder) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const order = await options.getMerchantOrder({
      orderId: context.req.param("orderId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });

    if (!order.ok) {
      return context.json({ error: order.error }, order.status);
    }

    return context.json({
      order: order.order,
    });
  });

  async function mutateResolvedMerchantOrder(
    context: Context<{ Variables: PlatformAppVariables }>,
    action: MerchantOrderAction,
  ) {
    if (!options.mutateMerchantOrder) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    const commerce = getResolvedCommerce(merchant.result.context, {
      requireStockLocation: action === "fulfill",
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    const orderId = context.req.param("orderId");
    const fulfillmentId = context.req.param("fulfillmentId");

    if (!orderId) {
      return context.json({ error: "order_not_found" }, 404);
    }

    if (action === "deliver" && !fulfillmentId) {
      return context.json({ error: "order_fulfillment_not_found" }, 404);
    }

    const order = await options.mutateMerchantOrder({
      action,
      ...(action === "deliver" ? { fulfillmentId } : {}),
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      ...(action === "fulfill" || action === "finish"
        ? {
            stockLocationId: commerce.context.medusaStockLocationId ?? undefined,
            shippingOptionId: merchant.result.context.medusaShippingOptionId ?? undefined,
          }
        : {}),
    });

    if (!order.ok) {
      return context.json({ error: order.error }, order.status);
    }

    // Dashboard mark-paid often does not fire Medusa payment.captured (metadata / mark-as-paid
    // paths). Emit payment.paid from platform so Telegram + in-app stay in sync with Chapa webhooks.
    if (action === "mark-paid" && options.recordNotificationEvent) {
      void options
        .recordNotificationEvent({
          tenantId: merchant.result.context.tenantId,
          eventType: "payment.paid",
          payload: buildPaymentPaidPayload(order.order, "dashboard_mark_paid"),
        })
        .catch(() => undefined);
    }

    // Cancel also emits via Medusa order.canceled subscriber; platform emit is a backup.
    // recordNotificationEvent dedupes per order so merchants get one alert.
    if (action === "cancel" && options.recordNotificationEvent) {
      void options
        .recordNotificationEvent({
          tenantId: merchant.result.context.tenantId,
          eventType: "order.cancelled",
          payload: buildOrderCancelledPayload(order.order, "dashboard_cancel"),
        })
        .catch(() => undefined);
    }

    return context.json({
      order: order.order,
    });
  }

  app.post("/platform/merchant/orders/:orderId/cancel", (context) =>
    mutateResolvedMerchantOrder(context, "cancel"),
  );

  app.post("/platform/merchant/orders/:orderId/complete", (context) =>
    mutateResolvedMerchantOrder(context, "complete"),
  );

  app.post("/platform/merchant/orders/:orderId/fulfill", (context) =>
    mutateResolvedMerchantOrder(context, "fulfill"),
  );

  app.post("/platform/merchant/orders/:orderId/fulfillments/:fulfillmentId/deliver", (context) =>
    mutateResolvedMerchantOrder(context, "deliver"),
  );

  app.post("/platform/merchant/orders/:orderId/mark-paid", (context) =>
    mutateResolvedMerchantOrder(context, "mark-paid"),
  );

  app.post("/platform/merchant/orders/:orderId/finish", async (context) => {
    if (!options.mutateMerchantOrder) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) {
      return merchant.response;
    }

    const body = (await context.req.json().catch(() => ({}))) as { markPaid?: unknown };
    const markPaid = body.markPaid === true;

    const commerce = getResolvedCommerce(merchant.result.context, {
      requireStockLocation: true,
    });
    if (!commerce.ok) {
      // Finish may not need stock if already fulfilled — retry without requirement.
      const loose = getResolvedCommerce(merchant.result.context);
      if (!loose.ok) {
        return context.json({ error: loose.error }, loose.status);
      }

      const orderId = context.req.param("orderId");
      if (!orderId) {
        return context.json({ error: "order_not_found" }, 404);
      }

      const order = await options.mutateMerchantOrder({
        action: "finish",
        markPaid,
        orderId,
        salesChannelId: loose.context.medusaSalesChannelId,
        stockLocationId: loose.context.medusaStockLocationId ?? undefined,
        shippingOptionId: merchant.result.context.medusaShippingOptionId ?? undefined,
      });

      if (!order.ok) {
        return context.json({ error: order.error }, order.status);
      }
      if (markPaid && options.recordNotificationEvent) {
        void options
          .recordNotificationEvent({
            tenantId: merchant.result.context.tenantId,
            eventType: "payment.paid",
            payload: buildPaymentPaidPayload(order.order, "dashboard_finish_mark_paid"),
          })
          .catch(() => undefined);
      }
      return context.json({ order: order.order });
    }

    const orderId = context.req.param("orderId");
    if (!orderId) {
      return context.json({ error: "order_not_found" }, 404);
    }

    const order = await options.mutateMerchantOrder({
      action: "finish",
      markPaid,
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId: commerce.context.medusaStockLocationId ?? undefined,
      shippingOptionId: merchant.result.context.medusaShippingOptionId ?? undefined,
    });

    if (!order.ok) {
      return context.json({ error: order.error }, order.status);
    }

    if (markPaid && options.recordNotificationEvent) {
      void options
        .recordNotificationEvent({
          tenantId: merchant.result.context.tenantId,
          eventType: "payment.paid",
          payload: buildPaymentPaidPayload(order.order, "dashboard_finish_mark_paid"),
        })
        .catch(() => undefined);
    }

    return context.json({ order: order.order });
  });

  app.post("/platform/merchant/orders/:orderId/recheck-payment", async (context) => {
    if (!options.recheckMerchantOrderPayment) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) {
      return merchant.response;
    }

    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    const orderId = context.req.param("orderId");
    if (!orderId) {
      return context.json({ error: "order_not_found" }, 404);
    }

    const result = await options.recheckMerchantOrderPayment({
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      tenantId: merchant.result.context.tenantId,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({ order: result.order });
  });
}
