import type { Context, Hono } from "hono";
import { parseMerchantOrderListQuery } from "../../../adapters/medusa/order/list-query.js";
import type {
  MerchantOrderAction,
  PlatformAppOptions,
  PlatformAppVariables,
} from "../../../app.js";
import { parseOrderSettlementInput } from "../../../lib/order-settlement-input.js";
import { parseOrderRefundInput } from "../../../lib/order-refund-input.js";
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

    const orders = await options.listMerchantOrders(
      parseMerchantOrderListQuery(
        {
          created: context.req.query("created"),
          createdFrom: context.req.query("createdFrom"),
          createdTo: context.req.query("createdTo"),
          customerId: context.req.query("customerId"),
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

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: {
        orders: [action === "cancel" ? "cancel" : action === "refund" ? "refund" : "update"],
      },
    });
    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    if ((action === "deliver" || action === "ship") && !fulfillmentId) {
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

    const body = (await context.req.json().catch(() => ({}))) as Record<string, unknown>;
    const settlement = action === "mark-paid" ? parseOrderSettlementInput(body) : undefined;
    if (action === "mark-paid" && !settlement) {
      return context.json({ error: "settlement_method_required" }, 400);
    }
    const refund = action === "refund" ? parseOrderRefundInput(body) : undefined;
    if (action === "refund" && !refund) {
      return context.json({ error: "order_refund_amount_invalid" }, 400);
    }

    const order = await options.mutateMerchantOrder({
      action,
      ...(action === "deliver" || action === "ship" ? { fulfillmentId } : {}),
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      ...(action === "fulfill" || action === "finish"
        ? {
            stockLocationId: commerce.context.medusaStockLocationId ?? undefined,
            shippingOptionId: commerce.context.medusaShippingOptionId ?? undefined,
          }
        : {}),
      ...(settlement ? { settlement, source: "dashboard" as const } : {}),
      ...(refund ? { refund } : {}),
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

  app.post(
    "/platform/tenants/:tenantId/orders/:orderId/fulfillments/:fulfillmentId/ship",
    (context) => mutateSelectedTenantOrder(context, "ship"),
  );

  app.post("/platform/tenants/:tenantId/orders/:orderId/mark-paid", (context) =>
    mutateSelectedTenantOrder(context, "mark-paid"),
  );

  app.post("/platform/tenants/:tenantId/orders/:orderId/refund", (context) =>
    mutateSelectedTenantOrder(context, "refund"),
  );

  app.post("/platform/tenants/:tenantId/orders/:orderId/finish", async (context) => {
    if (!options.getTenantCommerceContext || !options.mutateMerchantOrder) {
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

    const order = await options.mutateMerchantOrder({
      action: "finish",
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId: commerce.context.medusaStockLocationId ?? undefined,
      shippingOptionId: commerce.context.medusaShippingOptionId ?? undefined,
    });

    if (!order.ok) {
      return context.json({ error: order.error }, order.status);
    }

    return context.json({ order: order.order });
  });

  app.post("/platform/tenants/:tenantId/orders/:orderId/recheck-payment", async (context) => {
    if (!options.getTenantCommerceContext || !options.recheckMerchantOrderPayment) {
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

    const result = await options.recheckMerchantOrderPayment({
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      tenantId,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({ order: result.order });
  });
}
