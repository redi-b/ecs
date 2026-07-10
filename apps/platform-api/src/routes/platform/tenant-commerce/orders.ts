import type { Context, Hono } from "hono";
import type {
  MerchantOrderAction,
  PlatformAppOptions,
  PlatformAppVariables,
} from "../../../app.js";
import { getPaginationValue } from "../../shared.js";

export function registerPlatformTenantOrdersRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  app.get("/platform/tenants/:tenantId/orders", async (context) => {
    if (!options.getTenantCommerceContext || !options.listMerchantOrders) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");

    if (!tenantId) {
      return context.json({ error: "tenant_not_found" }, 404);
    }

    const commerce = await options.getTenantCommerceContext({
      tenantId,
      userId: session.user.id,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
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

  app.get("/platform/tenants/:tenantId/orders/:orderId", async (context) => {
    if (!options.getTenantCommerceContext || !options.getMerchantOrder) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const orderId = context.req.param("orderId");

    if (!tenantId || !orderId) {
      return context.json({ error: "order_not_found" }, 404);
    }

    const commerce = await options.getTenantCommerceContext({
      tenantId,
      userId: session.user.id,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
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

  async function mutateSelectedTenantOrder(
    context: Context<{ Variables: PlatformAppVariables }>,
    action: MerchantOrderAction,
  ) {
    if (!options.getTenantCommerceContext || !options.mutateMerchantOrder) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const orderId = context.req.param("orderId");
    const fulfillmentId = context.req.param("fulfillmentId");

    if (!tenantId || !orderId) {
      return context.json({ error: "order_not_found" }, 404);
    }

    if (action === "deliver" && !fulfillmentId) {
      return context.json({ error: "order_fulfillment_not_found" }, 404);
    }

    const commerce = await options.getTenantCommerceContext({
      tenantId,
      userId: session.user.id,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (action === "fulfill" && !commerce.context.medusaStockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
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

  app.post("/platform/tenants/:tenantId/orders/:orderId/cancel", (context) =>
    mutateSelectedTenantOrder(context, "cancel"),
  );

  app.post("/platform/tenants/:tenantId/orders/:orderId/complete", (context) =>
    mutateSelectedTenantOrder(context, "complete"),
  );

  app.post("/platform/tenants/:tenantId/orders/:orderId/fulfill", (context) =>
    mutateSelectedTenantOrder(context, "fulfill"),
  );

  app.post(
    "/platform/tenants/:tenantId/orders/:orderId/fulfillments/:fulfillmentId/deliver",
    (context) => mutateSelectedTenantOrder(context, "deliver"),
  );
}
