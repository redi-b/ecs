import type { Context, Hono } from "hono";

import type { MerchantOrderAction, PlatformAppOptions, PlatformAppVariables } from "../app.js";
import {
  getJsonBody,
  getOptionalBodyNumber,
  getOptionalBodyString,
  getOptionalBodyStringArray,
  getPaginationValue,
  getRequestHost,
  getRequiredBodyString,
  storeErrorStatus,
} from "./shared.js";

export function registerMerchantRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  async function getAuthorizedMerchantContext(
    context: Context<{ Variables: PlatformAppVariables }>,
  ) {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return {
        ok: false as const,
        response: context.json({ error: "auth_required" }, 401),
      };
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return {
        ok: false as const,
        response: context.json({ error: result.error }, storeErrorStatus[result.error]),
      };
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return {
        ok: false as const,
        response: context.json({ error: "dashboard_forbidden" }, 403),
      };
    }

    return {
      ok: true as const,
      authorization,
      result,
      session,
    };
  }

  app.get("/platform/merchant/dashboard", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json(
        {
          error: result.error,
        },
        storeErrorStatus[result.error],
      );
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    return context.json({
      tenant: {
        id: result.context.tenantId,
        name: result.context.tenantName,
        handle: result.context.tenantHandle,
        status: result.context.status,
      },
      domain: {
        id: result.context.domainId,
        hostname: result.context.hostname,
      },
      actor: authorization.actor,
      commerce: {
        hasPublishableKey: Boolean(result.context.medusaPublishableKeyId),
        hasSalesChannel: Boolean(result.context.medusaSalesChannelId),
        hasStore: Boolean(result.context.medusaStoreId),
      },
      storefront: {
        isPublished: Boolean(result.context.publishedRevisionId),
        publishedRevisionId: result.context.publishedRevisionId,
        templateId: result.context.templateId,
        templateVersion: result.context.templateVersion,
      },
    });
  });

  app.get("/platform/merchant/notifications/preferences", async (context) => {
    if (!options.listNotificationPreferences) {
      return context.json({ error: "notifications_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    const preferences = await options.listNotificationPreferences({
      tenantId: merchant.result.context.tenantId,
    });

    return context.json({
      preferences: preferences.preferences,
    });
  });

  app.post("/platform/merchant/notifications/preferences", async (context) => {
    if (!options.upsertNotificationPreference) {
      return context.json({ error: "notifications_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    const body = await getJsonBody(context.req.raw);
    const channel = getRequiredBodyString(body, "channel");
    const target = getRequiredBodyString(body, "target");
    const rawEvents =
      typeof body === "object" && body !== null && "events" in body
        ? (body as { events?: unknown }).events
        : undefined;
    const enabled =
      typeof body === "object" &&
      body !== null &&
      "enabled" in body &&
      typeof (body as { enabled?: unknown }).enabled === "boolean"
        ? (body as { enabled: boolean }).enabled
        : true;

    if (!channel) {
      return context.json({ error: "missing_channel" }, 400);
    }

    if (!target) {
      return context.json({ error: "missing_target" }, 400);
    }

    if (!Array.isArray(rawEvents) || !rawEvents.every((event) => typeof event === "string")) {
      return context.json({ error: "notification_events_invalid" }, 400);
    }

    const result = await options.upsertNotificationPreference({
      channel,
      enabled,
      events: rawEvents,
      target,
      tenantId: merchant.result.context.tenantId,
      userId: merchant.session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      preference: result.preference,
    });
  });

  app.post("/platform/merchant/products", async (context) => {
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

    if (!result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!options.createMerchantProduct) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const title = getRequiredBodyString(body, "title");

    if (!title) {
      return context.json({ error: "missing_title" }, 400);
    }

    const product = await options.createMerchantProduct({
      title,
      description: getOptionalBodyString(body, "description"),
      handle: getOptionalBodyString(body, "handle"),
      collectionId: getOptionalBodyString(body, "collectionId"),
      categoryIds: getOptionalBodyStringArray(body, "categoryIds"),
      priceAmount: getOptionalBodyNumber(body, "priceAmount"),
      currencyCode: getOptionalBodyString(body, "currencyCode") ?? "etb",
      regionId: result.context.medusaRegionId,
      status: getOptionalBodyString(body, "status"),
      thumbnail: getOptionalBodyString(body, "thumbnail"),
      salesChannelId: result.context.medusaSalesChannelId,
    });

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
    });
  });

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

    if (!result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!options.listMerchantOrders) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const orders = await options.listMerchantOrders({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      salesChannelId: result.context.medusaSalesChannelId,
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

    if (!result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!options.getMerchantOrder) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const order = await options.getMerchantOrder({
      orderId: context.req.param("orderId"),
      salesChannelId: result.context.medusaSalesChannelId,
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

    if (!merchant.result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (action === "fulfill" && !merchant.result.context.medusaStockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
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
      salesChannelId: merchant.result.context.medusaSalesChannelId,
      ...(action === "fulfill"
        ? { stockLocationId: merchant.result.context.medusaStockLocationId ?? undefined }
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

  app.get("/platform/merchant/products", async (context) => {
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

    if (!result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!options.listMerchantProducts) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const products = await options.listMerchantProducts({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      salesChannelId: result.context.medusaSalesChannelId,
    });

    if (!products.ok) {
      return context.json({ error: products.error }, products.status);
    }

    return context.json({
      products: products.products,
      count: products.count,
      limit: products.limit,
      offset: products.offset,
    });
  });

  app.get("/platform/merchant/products/:productId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    if (!merchant.result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!options.getMerchantProduct) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const product = await options.getMerchantProduct({
      productId: context.req.param("productId"),
      salesChannelId: merchant.result.context.medusaSalesChannelId,
    });

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
    });
  });

  app.get("/platform/merchant/products/:productId/stock", async (context) => {
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

    if (!result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!result.context.medusaStockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    if (!options.getMerchantProductStock) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const stock = await options.getMerchantProductStock({
      productId: context.req.param("productId"),
      salesChannelId: result.context.medusaSalesChannelId,
      stockLocationId: result.context.medusaStockLocationId,
    });

    if (!stock.ok) {
      return context.json({ error: stock.error }, stock.status);
    }

    return context.json({
      stock: stock.stock,
    });
  });

  app.post("/platform/merchant/products/:productId/stock", async (context) => {
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

    if (!result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!result.context.medusaStockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    if (!options.updateMerchantProductStock) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const stockedQuantity = getOptionalBodyNumber(body, "stockedQuantity");

    if (stockedQuantity === undefined || stockedQuantity < 0) {
      return context.json({ error: "invalid_stocked_quantity" }, 400);
    }

    const stock = await options.updateMerchantProductStock({
      productId: context.req.param("productId"),
      salesChannelId: result.context.medusaSalesChannelId,
      stockLocationId: result.context.medusaStockLocationId,
      stockedQuantity,
    });

    if (!stock.ok) {
      return context.json({ error: stock.error }, stock.status);
    }

    return context.json({
      stock: stock.stock,
    });
  });

  app.post("/platform/merchant/products/:productId", async (context) => {
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

    if (!result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!options.updateMerchantProduct) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const product = await options.updateMerchantProduct({
      productId: context.req.param("productId"),
      title: getOptionalBodyString(body, "title"),
      description: getOptionalBodyString(body, "description"),
      handle: getOptionalBodyString(body, "handle"),
      collectionId: getOptionalBodyString(body, "collectionId"),
      categoryIds: getOptionalBodyStringArray(body, "categoryIds"),
      status: getOptionalBodyString(body, "status"),
      thumbnail: getOptionalBodyString(body, "thumbnail"),
      salesChannelId: result.context.medusaSalesChannelId,
    });

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
    });
  });
}
