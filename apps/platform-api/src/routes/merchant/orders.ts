import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import type { Context } from "hono";
import type { MerchantOrderAction } from "../../app.js";
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

    const orders = await options.listMerchantOrders({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });

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
      ...(action === "fulfill"
        ? { stockLocationId: commerce.context.medusaStockLocationId ?? undefined }
        : {}),
    });

    if (!order.ok) {
      return context.json({ error: order.error }, order.status);
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


}
