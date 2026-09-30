import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { parseMerchantOrderListQuery } from "../../adapters/medusa/order/list-query.js";
import type { MerchantOrderAction, PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { parseOrderRefundInput } from "../../lib/order-refund-input.js";
import { parseOrderReturnInput } from "../../lib/order-return-input.js";
import { parseOrderReturnReceiptInput } from "../../lib/order-return-receipt-input.js";
import { parseOrderSettlementInput } from "../../lib/order-settlement-input.js";
import { recordReturnMovements } from "../../lib/record-return-movements.js";
import type { OrderSettlementInput } from "../../lib/settlement.js";
import {
  exportOrdersToCsv,
  orderExportFilename,
} from "../../modules/data-transfer/order-export.js";
import { getPaginationValue, getRequestHost, storeErrorStatus } from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";

const parseSettlementBody = parseOrderSettlementInput;

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
      permission: { orders: ["read"] },
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

  app.get("/platform/merchant/orders/export.csv", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const tenant = await options.resolveTenantForHost(host);
    if (!tenant.ok) {
      return context.json({ error: tenant.error }, storeErrorStatus[tenant.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: tenant.context.tenantId,
      userId: session.user.id,
      permission: { orders: ["export"] },
    });
    if (!authorization?.ok) return context.json({ error: "dashboard_forbidden" }, 403);

    const commerce = getResolvedCommerce(tenant.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.listMerchantOrders || !options.recordMerchantDataExport) {
      return context.json({ error: "export_backend_unavailable" }, 503);
    }

    const result = await exportOrdersToCsv({
      filters: parseMerchantOrderListQuery(context.req.query(), {
        limit: 100,
        offset: 0,
        salesChannelId: commerce.context.medusaSalesChannelId,
      }),
      listOrders: options.listMerchantOrders,
      salesChannelId: commerce.context.medusaSalesChannelId,
    });
    if (!result.ok) {
      return context.json({ error: result.error }, result.status as ContentfulStatusCode);
    }

    try {
      await options.recordMerchantDataExport({
        actorUserId: session.user.id,
        exportType: "orders",
        rowCount: result.rowCount,
        schemaVersion: result.schemaVersion,
        tenantId: tenant.context.tenantId,
      });
    } catch {
      return context.json({ error: "export_audit_unavailable" }, 503);
    }

    return new Response(result.csv, {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${orderExportFilename()}"`,
        "content-type": "text/csv; charset=utf-8",
        "x-ecs-export-schema": result.schemaVersion,
        "x-ecs-export-orders": String(result.orderCount),
        "x-ecs-export-rows": String(result.rowCount),
      },
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
      permission: { orders: ["read"] },
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
    const mutateMerchantOrder = options.mutateMerchantOrder;

    const merchant = await getAuthorizedMerchantContext(context, {
      orders: [action === "cancel" ? "cancel" : action === "refund" ? "refund" : "update"],
    });

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

    if ((action === "deliver" || action === "ship") && !fulfillmentId) {
      return context.json({ error: "order_fulfillment_not_found" }, 404);
    }

    const body = (await context.req.json().catch(() => ({}))) as Record<string, unknown>;
    const operationChannel = body.channel === "pos" ? "pos" : "assisted_sale";
    let settlement: OrderSettlementInput | undefined;
    if (action === "mark-paid") {
      const parsed = parseSettlementBody(body);
      if (!parsed) {
        return context.json({ error: "settlement_method_required" }, 400);
      }
      settlement = parsed;
    }
    const refund = action === "refund" ? parseOrderRefundInput(body) : undefined;
    if (action === "refund" && !refund) {
      return context.json({ error: "order_refund_amount_invalid" }, 400);
    }

    const mutationInput = {
      action,
      ...(action === "deliver" || action === "ship" ? { fulfillmentId } : {}),
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      ...(action === "fulfill" || action === "finish"
        ? {
            stockLocationId: commerce.context.medusaStockLocationId ?? undefined,
            shippingOptionId: merchant.result.context.medusaShippingOptionId ?? undefined,
          }
        : {}),
      ...(settlement
        ? {
            settlement,
            source: operationChannel === "pos" ? ("pos" as const) : ("dashboard" as const),
          }
        : {}),
      ...(refund ? { refund } : {}),
      ...(typeof body.paymentReference === "string"
        ? { paymentReference: body.paymentReference }
        : {}),
    } as const;
    let order: Awaited<ReturnType<NonNullable<typeof options.mutateMerchantOrder>>>;
    if ((action === "refund" || action === "mark-paid") && options.executeMerchantMutation) {
      const idempotencyKey = context.req.header("idempotency-key")?.trim();
      if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
      const execution = await options.executeMerchantMutation(
        {
          actorUserId: merchant.session.user.id,
          idempotencyKey,
          operation: action === "refund" ? "order.refund" : "order.mark_paid",
          payload: mutationInput,
          requestId: context.get("requestId"),
          resourceKeys: [`order:${orderId}`],
          source: operationChannel,
          tenantId: merchant.result.context.tenantId,
        },
        () => mutateMerchantOrder(mutationInput),
      );
      if (!execution.ok) return context.json({ error: execution.error }, execution.status);
      context.header("x-idempotent-replay", String(execution.replayed));
      order = execution.value;
    } else {
      order = await mutateMerchantOrder(mutationInput);
    }

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

  app.post("/platform/merchant/orders/:orderId/fulfillments/:fulfillmentId/ship", (context) =>
    mutateResolvedMerchantOrder(context, "ship"),
  );

  app.post("/platform/merchant/orders/:orderId/mark-paid", (context) =>
    mutateResolvedMerchantOrder(context, "mark-paid"),
  );

  app.post("/platform/merchant/orders/:orderId/refund", (context) =>
    mutateResolvedMerchantOrder(context, "refund"),
  );

  app.post("/platform/merchant/orders/:orderId/returns", async (context) => {
    if (!options.createMerchantReturn || !options.executeMerchantMutation) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["update"] });
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context, { requireStockLocation: true });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const orderId = context.req.param("orderId");
    const body = parseOrderReturnInput(await context.req.json().catch(() => null));
    if (!orderId || !body) {
      return context.json({ error: "order_return_invalid" }, 400);
    }
    const input = {
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      locationId: commerce.context.medusaStockLocationId ?? undefined,
      items: body.items,
      ...(body.note ? { note: body.note } : {}),
    };
    const execution = await options.executeMerchantMutation(
      {
        actorUserId: merchant.session.user.id,
        idempotencyKey,
        operation: "order.return.create",
        payload: input,
        requestId: context.get("requestId"),
        resourceKeys: [`order:${orderId}`],
        source: "assisted_sale",
        tenantId: merchant.result.context.tenantId,
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

  app.post("/platform/merchant/orders/:orderId/returns/:returnId/receive", async (context) => {
    if (
      !options.receiveMerchantReturn ||
      !options.executeMerchantMutation ||
      !options.appendMerchantInventoryMovement
    ) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["update"] });
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context, { requireStockLocation: true });
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const orderId = context.req.param("orderId");
    const returnId = context.req.param("returnId");
    const body = parseOrderReturnReceiptInput(await context.req.json().catch(() => null));
    if (!orderId || !returnId || !body) {
      return context.json({ error: "order_return_invalid" }, 400);
    }
    const input = {
      orderId,
      returnId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      items: body.items,
    };
    const actorUserId = merchant.session.user.id;
    const tenantId = merchant.result.context.tenantId;
    const locationId = commerce.context.medusaStockLocationId as string;
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
  });

  app.post("/platform/merchant/orders/:orderId/settlement", async (context) => {
    if (!options.updateMerchantOrderSettlement) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    const merchant = await getAuthorizedMerchantContext(context, { orders: ["update"] });
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);

    const orderId = context.req.param("orderId");
    if (!orderId) return context.json({ error: "order_not_found" }, 404);

    const body = (await context.req.json().catch(() => ({}))) as Record<string, unknown>;
    const settlement = parseSettlementBody(body);
    if (!settlement) {
      return context.json({ error: "settlement_method_required" }, 400);
    }

    const order = await options.updateMerchantOrderSettlement({
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      settlement,
    });
    if (!order.ok) return context.json({ error: order.error }, order.status);
    return context.json({ order: order.order });
  });

  app.post("/platform/merchant/orders/:orderId/finish", async (context) => {
    if (!options.mutateMerchantOrder) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context, { orders: ["update"] });
    if (!merchant.ok) {
      return merchant.response;
    }

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
        orderId,
        salesChannelId: loose.context.medusaSalesChannelId,
        stockLocationId: loose.context.medusaStockLocationId ?? undefined,
        shippingOptionId: merchant.result.context.medusaShippingOptionId ?? undefined,
      });

      if (!order.ok) {
        return context.json({ error: order.error }, order.status);
      }
      return context.json({ order: order.order });
    }

    const orderId = context.req.param("orderId");
    if (!orderId) {
      return context.json({ error: "order_not_found" }, 404);
    }

    const order = await options.mutateMerchantOrder({
      action: "finish",
      orderId,
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId: commerce.context.medusaStockLocationId ?? undefined,
      shippingOptionId: merchant.result.context.medusaShippingOptionId ?? undefined,
    });

    if (!order.ok) {
      return context.json({ error: order.error }, order.status);
    }

    return context.json({ order: order.order });
  });

  app.post("/platform/merchant/orders/:orderId/recheck-payment", async (context) => {
    if (!options.recheckMerchantOrderPayment) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context, { orders: ["update"] });
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
