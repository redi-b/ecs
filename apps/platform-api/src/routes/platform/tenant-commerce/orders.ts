import type { Context, Hono } from "hono";
import { parseMerchantOrderListQuery } from "../../../adapters/medusa/order/list-query.js";
import type {
  MerchantOrderAction,
  PlatformAppOptions,
  PlatformAppVariables,
} from "../../../app.js";

type TenantOrderRouteDependencies = Pick<
  PlatformAppOptions,
  | "authorizeDashboardForTenant"
  | "appendMerchantInventoryMovement"
  | "createMerchantReturn"
  | "receiveMerchantReturn"
  | "executeMerchantMutation"
  | "getMerchantOrder"
  | "getSession"
  | "getTenantCommerceContext"
  | "listMerchantOrders"
  | "mutateMerchantOrder"
  | "recheckMerchantOrderPayment"
>;

import { parseOrderRefundInput } from "../../../lib/order-refund-input.js";
import { parseOrderReturnInput } from "../../../lib/order-return-input.js";
import { parseOrderReturnReceiptInput } from "../../../lib/order-return-receipt-input.js";
import { parseOrderSettlementInput } from "../../../lib/order-settlement-input.js";
import { recordReturnMovements } from "../../../lib/record-return-movements.js";
import { getPaginationValue } from "../../shared.js";

export function registerPlatformTenantOrdersRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: TenantOrderRouteDependencies,
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

  app.post("/platform/tenants/:tenantId/orders/:orderId/returns", async (context) => {
    if (
      !options.getTenantCommerceContext ||
      !options.createMerchantReturn ||
      !options.executeMerchantMutation
    ) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);

    const tenantId = context.req.param("tenantId");
    const orderId = context.req.param("orderId");
    if (!tenantId || !orderId) return context.json({ error: "order_not_found" }, 404);

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { orders: ["update"] },
    });
    if (!authorization?.ok) return context.json({ error: "dashboard_forbidden" }, 403);

    const commerce = await options.getTenantCommerceContext({ tenantId, userId: session.user.id });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!commerce.context.medusaStockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const body = parseOrderReturnInput(await context.req.json().catch(() => null));
    if (!body) return context.json({ error: "order_return_invalid" }, 400);

    const input = {
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      locationId: commerce.context.medusaStockLocationId,
      items: body.items,
      ...(body.note ? { note: body.note } : {}),
    };
    const execution = await options.executeMerchantMutation(
      {
        actorUserId: session.user.id,
        idempotencyKey,
        operation: "order.return.create",
        payload: input,
        requestId: context.get("requestId"),
        resourceKeys: [`order:${orderId}`],
        source: "assisted_sale",
        tenantId,
      },
      () =>
        options.createMerchantReturn?.(input) as ReturnType<
          NonNullable<typeof options.createMerchantReturn>
        >,
    );
    if (!execution.ok) return context.json({ error: execution.error }, execution.status);
    context.header("x-idempotent-replay", String(execution.replayed));
    if (!execution.value.ok) {
      return context.json({ error: execution.value.error }, execution.value.status);
    }
    return context.json({ return: execution.value.orderReturn }, 201);
  });

  app.post(
    "/platform/tenants/:tenantId/orders/:orderId/returns/:returnId/receive",
    async (context) => {
      if (
        !options.getTenantCommerceContext ||
        !options.receiveMerchantReturn ||
        !options.executeMerchantMutation ||
        !options.appendMerchantInventoryMovement
      ) {
        return context.json({ error: "commerce_backend_unavailable" }, 503);
      }
      const session = await options.getSession?.(context.req.raw.headers);
      if (!session) return context.json({ error: "auth_required" }, 401);
      const tenantId = context.req.param("tenantId");
      const orderId = context.req.param("orderId");
      const returnId = context.req.param("returnId");
      if (!tenantId || !orderId || !returnId) {
        return context.json({ error: "order_not_found" }, 404);
      }
      const authorization = await options.authorizeDashboardForTenant?.({
        tenantId,
        userId: session.user.id,
        permission: { orders: ["update"] },
      });
      if (!authorization?.ok) return context.json({ error: "dashboard_forbidden" }, 403);
      const commerce = await options.getTenantCommerceContext({
        tenantId,
        userId: session.user.id,
      });
      if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
      const locationId = commerce.context.medusaStockLocationId;
      if (!locationId) return context.json({ error: "inventory_location_unavailable" }, 503);
      const idempotencyKey = context.req.header("idempotency-key")?.trim();
      if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
      const body = parseOrderReturnReceiptInput(await context.req.json().catch(() => null));
      if (!body) return context.json({ error: "order_return_invalid" }, 400);
      const input = {
        orderId,
        returnId,
        salesChannelId: commerce.context.medusaSalesChannelId,
        items: body.items,
      };
      const actorUserId = session.user.id;
      const execution = await options.executeMerchantMutation(
        {
          actorUserId,
          idempotencyKey,
          operation: "order.return.receive",
          payload: input,
          requestId: context.get("requestId"),
          resourceKeys: [`order:${orderId}`, `return:${returnId}`],
          source: "assisted_sale",
          tenantId,
        },
        async () => {
          const result = await options.receiveMerchantReturn?.(input);
          if (result?.ok) {
            await recordReturnMovements({
              actorUserId,
              append: options.appendMerchantInventoryMovement as NonNullable<
                typeof options.appendMerchantInventoryMovement
              >,
              locationId,
              result,
              tenantId,
            });
          }
          return result as Awaited<ReturnType<NonNullable<typeof options.receiveMerchantReturn>>>;
        },
      );
      if (!execution.ok) return context.json({ error: execution.error }, execution.status);
      context.header("x-idempotent-replay", String(execution.replayed));
      if (!execution.value.ok) {
        return context.json({ error: execution.value.error }, execution.value.status);
      }
      return context.json({ return: execution.value.orderReturn });
    },
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
