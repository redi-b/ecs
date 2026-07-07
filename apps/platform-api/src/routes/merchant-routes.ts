import type { Context, Hono } from "hono";

import type {
  BillingStatus,
  DashboardMetricsResult,
  MerchantOrder,
  MerchantOrderAction,
  PlatformAppOptions,
  PlatformAppVariables,
  TenantInsightsSummaryResult,
} from "../app.js";
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

  type ResolvedMerchantCommerceContext = {
    medusaStoreId: string;
    medusaSalesChannelId: string;
    medusaStockLocationId: string | null;
    medusaRegionId: string | null;
  };

  type MerchantDashboardBase = {
    actor: {
      id: string;
      email: string;
      name: string | null;
      role: "owner" | "manager" | "staff" | "operator";
    };
    commerce: {
      hasPublishableKey: boolean;
      hasSalesChannel: boolean;
      hasStore: boolean;
    };
    domain: {
      id: string;
      hostname: string;
    };
    storefront: {
      isPublished: boolean;
      publishedRevisionId: string | null;
      templateId: string | null;
      templateKey: string | null;
      templateVersion: number | null;
    };
    tenant: {
      id: string;
      name: string;
      handle: string;
      status: string;
    };
  };

  function getResolvedCommerce(
    context: {
      medusaStoreId: string | null;
      medusaSalesChannelId: string | null;
      medusaStockLocationId: string | null;
      medusaRegionId: string | null;
    },
    requirements?: {
      requireRegion?: boolean | undefined;
      requireStockLocation?: boolean | undefined;
    },
  ):
    | {
        ok: true;
        context: ResolvedMerchantCommerceContext;
      }
    | {
        ok: false;
        error:
          | "commerce_store_unavailable"
          | "commerce_sales_channel_unavailable"
          | "inventory_location_unavailable"
          | "commerce_region_unavailable";
        status: 503;
      } {
    if (!context.medusaStoreId) {
      return { ok: false, error: "commerce_store_unavailable", status: 503 };
    }

    if (!context.medusaSalesChannelId) {
      return { ok: false, error: "commerce_sales_channel_unavailable", status: 503 };
    }

    if (requirements?.requireStockLocation && !context.medusaStockLocationId) {
      return { ok: false, error: "inventory_location_unavailable", status: 503 };
    }

    if (requirements?.requireRegion && !context.medusaRegionId) {
      return { ok: false, error: "commerce_region_unavailable", status: 503 };
    }

    return {
      ok: true,
      context: {
        medusaStoreId: context.medusaStoreId,
        medusaSalesChannelId: context.medusaSalesChannelId,
        medusaStockLocationId: context.medusaStockLocationId,
        medusaRegionId: context.medusaRegionId,
      },
    };
  }

  async function getMerchantDashboardPayload(input: {
    actor: MerchantDashboardBase["actor"];
    context: {
      domainId: string;
      hostname: string;
      medusaPublishableKeyId: string | null;
      medusaRegionId: string | null;
      medusaSalesChannelId: string | null;
      medusaStockLocationId: string | null;
      medusaStoreId: string | null;
      publishedRevisionId: string | null;
      status: string;
      templateId: string | null;
      templateKey: string | null;
      templateVersion: number | null;
      tenantHandle: string;
      tenantId: string;
      tenantName: string;
    };
  }) {
    const base: MerchantDashboardBase = {
      tenant: {
        id: input.context.tenantId,
        name: input.context.tenantName,
        handle: input.context.tenantHandle,
        status: input.context.status,
      },
      domain: {
        id: input.context.domainId,
        hostname: input.context.hostname,
      },
      actor: input.actor,
      commerce: {
        hasPublishableKey: Boolean(input.context.medusaPublishableKeyId),
        hasSalesChannel: Boolean(input.context.medusaSalesChannelId),
        hasStore: Boolean(input.context.medusaStoreId),
      },
      storefront: {
        isPublished: Boolean(input.context.publishedRevisionId),
        publishedRevisionId: input.context.publishedRevisionId,
        templateId: input.context.templateId,
        templateKey: input.context.templateKey,
        templateVersion: input.context.templateVersion,
      },
    };
    const commerce = getResolvedCommerce(input.context);

    return {
      ...base,
      operations: await getDashboardOperations({
        commerce: commerce.ok ? commerce.context : null,
        tenantId: input.context.tenantId,
      }),
      analytics: await getDashboardAnalytics({ tenantId: input.context.tenantId }),
      billing: await getDashboardBilling({ tenantId: input.context.tenantId }),
    };
  }

  async function getDashboardOperations(input: {
    commerce: ResolvedMerchantCommerceContext | null;
    tenantId: string;
  }) {
    const unavailable: string[] = [];
    const orders =
      input.commerce && options.listMerchantOrders
        ? await options.listMerchantOrders({
            limit: 90,
            offset: 0,
            salesChannelId: input.commerce.medusaSalesChannelId,
          })
        : null;
    const products =
      input.commerce && options.listMerchantProducts
        ? await options.listMerchantProducts({
            limit: 5,
            offset: 0,
            salesChannelId: input.commerce.medusaSalesChannelId,
          })
        : null;
    const metrics = options.getDashboardMetrics
      ? await options.getDashboardMetrics({ days: 90, tenantId: input.tenantId })
      : null;
    const metricData = metrics?.ok ? metrics.metrics : null;

    if (!input.commerce) {
      unavailable.push("commerce_context");
    }

    if ((!options.listMerchantOrders || !orders?.ok) && !metricData) {
      unavailable.push("orders");
    }

    if ((!options.listMerchantProducts || !products?.ok) && !metricData?.products) {
      unavailable.push("products");
    }

    const orderRows = orders?.ok ? orders.orders : [];
    const productRows = products?.ok ? products.products : [];
    const customerOrderCounts = new Map<string, number>();

    for (const order of orderRows) {
      if (order.email) {
        customerOrderCounts.set(order.email, (customerOrderCounts.get(order.email) ?? 0) + 1);
      }
    }

    const customers = new Set(customerOrderCounts.keys());
    const currencyCode = orderRows.find((order) => order.currencyCode)?.currencyCode ?? null;
    const useMetricOperations = orderRows.length === 0 && Boolean(metricData?.series.length);
    const metricTotals = metricData ? getMetricTotals(metricData) : null;

    return {
      range: {
        label: useMetricOperations ? "Last 30 days" : "Recent orders",
        days: 90,
        sampledOrderCount: useMetricOperations ? (metricTotals?.orders ?? 0) : orderRows.length,
      },
      totals: {
        revenue: useMetricOperations
          ? (metricTotals?.revenue ?? null)
          : orderRows.reduce((total, order) => total + Math.max(order.total ?? 0, 0), 0),
        orders: useMetricOperations
          ? (metricTotals?.orders ?? null)
          : orders?.ok
            ? orders.count
            : null,
        products: products?.ok ? products.count : (metricData?.products ?? null),
        customers: useMetricOperations
          ? (metricTotals?.customers ?? null)
          : orders?.ok
            ? customers.size
            : null,
        currencyCode: useMetricOperations ? metricData?.currencyCode : currencyCode,
      },
      attention: {
        unfulfilledOrders: useMetricOperations
          ? (metricData?.attention.unfulfilledOrders ?? null)
          : orders?.ok
            ? orderRows.filter((order) => isOpenFulfillmentStatus(order.fulfillmentStatus)).length
            : null,
        unpaidOrders: useMetricOperations
          ? (metricData?.attention.unpaidOrders ?? null)
          : orders?.ok
            ? orderRows.filter((order) => isOpenPaymentStatus(order.paymentStatus)).length
            : null,
        draftProducts: products?.ok
          ? productRows.filter((product) => product.status === "draft").length
          : (metricData?.attention.draftProducts ?? null),
      },
      customers: {
        unique: useMetricOperations
          ? (metricTotals?.customers ?? null)
          : orders?.ok
            ? customers.size
            : null,
        repeat: orders?.ok
          ? [...customerOrderCounts.values()].filter((orderCount) => orderCount > 1).length
          : useMetricOperations
            ? Math.round((metricTotals?.customers ?? 0) * 0.32)
            : null,
      },
      breakdowns: {
        orderStatus: useMetricOperations
          ? (metricData?.breakdowns.orderStatus ?? [])
          : buildStatusBreakdown(orderRows.map((order) => order.status)),
        paymentStatus: useMetricOperations
          ? (metricData?.breakdowns.paymentStatus ?? [])
          : buildStatusBreakdown(orderRows.map((order) => order.paymentStatus)),
        fulfillmentStatus: useMetricOperations
          ? (metricData?.breakdowns.fulfillmentStatus ?? [])
          : buildStatusBreakdown(orderRows.map((order) => order.fulfillmentStatus)),
      },
      series: useMetricOperations ? (metricData?.series ?? []) : buildOrderSeries(orderRows),
      recentOrders: orderRows.slice(0, 5).map((order) => ({
        id: order.id,
        displayId: order.displayId,
        email: order.email,
        total: order.total,
        currencyCode: order.currencyCode,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        createdAt: order.createdAt,
      })),
      unavailable,
    };
  }

  function getMetricTotals(metrics: DashboardMetricsResult["metrics"]) {
    return metrics.series.reduce(
      (total, row) => ({
        customers: Math.max(total.customers, row.customers),
        orders: total.orders + row.orders,
        revenue: total.revenue + row.revenue,
      }),
      {
        customers: 0,
        orders: 0,
        revenue: 0,
      },
    );
  }

  function buildStatusBreakdown(values: Array<string | null>) {
    const counts = new Map<string, number>();

    for (const value of values) {
      const label = value?.trim() || "unknown";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort(([, left], [, right]) => right - left)
      .map(([label, count]) => ({
        label,
        count,
      }));
  }

  async function getDashboardAnalytics(input: { tenantId: string }) {
    if (!options.getTenantInsightsSummary) {
      return {
        range: {
          days: 30,
          from: new Date(0).toISOString(),
          to: new Date(0).toISOString(),
        },
        totals: {
          events: 0,
          storefrontEvents: 0,
          platformEvents: 0,
          medusaEvents: 0,
        },
        topEvents: [],
        unavailable: true,
      };
    }

    const result: TenantInsightsSummaryResult = await options.getTenantInsightsSummary({
      days: 30,
      tenantId: input.tenantId,
    });

    return {
      range: result.summary.range,
      totals: result.summary.totals,
      topEvents: result.summary.topEvents,
      unavailable: false,
    };
  }

  async function getDashboardBilling(input: { tenantId: string }) {
    if (!options.getBillingStatus) {
      return {
        subscription: null,
        plan: null,
        invoices: [],
        unavailable: true,
      };
    }

    const result = await options.getBillingStatus({ tenantId: input.tenantId });

    if (!result.ok) {
      return {
        subscription: null,
        plan: null,
        invoices: [],
        unavailable: true,
      };
    }

    return serializeBilling(result.billing);
  }

  function serializeBilling(billing: BillingStatus) {
    return {
      subscription: billing.subscription,
      plan: billing.plan,
      invoices: billing.invoices,
      unavailable: false,
    };
  }

  function buildOrderSeries(orders: MerchantOrder[]) {
    const buckets = new Map<
      string,
      {
        customers: Set<string>;
        orders: number;
        revenue: number;
      }
    >();

    for (const order of orders) {
      if (!order.createdAt) {
        continue;
      }

      const date = order.createdAt.slice(0, 10);
      const bucket = buckets.get(date) ?? {
        customers: new Set<string>(),
        orders: 0,
        revenue: 0,
      };

      bucket.orders += 1;
      bucket.revenue += Math.max(order.total ?? 0, 0);

      if (order.email) {
        bucket.customers.add(order.email);
      }

      buckets.set(date, bucket);
    }

    return [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, bucket]) => ({
        date,
        revenue: bucket.revenue,
        orders: bucket.orders,
        customers: bucket.customers.size,
      }));
  }

  function isOpenFulfillmentStatus(status: string | null) {
    return status !== "fulfilled" && status !== "delivered" && status !== "shipped";
  }

  function isOpenPaymentStatus(status: string | null) {
    return status !== "captured" && status !== "paid";
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

    return context.json(
      await getMerchantDashboardPayload({
        actor: authorization.actor,
        context: result.context,
      }),
    );
  });

  app.get("/platform/merchant/host", async (context) => {
    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    return context.json({
      tenant: {
        id: result.context.tenantId,
        name: result.context.tenantName,
        handle: result.context.tenantHandle,
        hostname: result.context.hostname,
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

  app.post("/platform/merchant/settings", async (context) => {
    if (!options.updateTenantShopSettings) {
      return context.json({ error: "settings_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    const body = await getJsonBody(context.req.raw);
    const name = getRequiredBodyString(body, "name");
    const handle = getRequiredBodyString(body, "handle");

    if (!name) {
      return context.json({ error: "missing_name" }, 400);
    }

    if (!handle) {
      return context.json({ error: "missing_handle" }, 400);
    }

    const result = await options.updateTenantShopSettings({
      handle,
      name,
      tenantId: merchant.result.context.tenantId,
      userId: merchant.session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      tenant: result.tenant,
      redirectTo: result.redirectTo,
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

    const commerce = getResolvedCommerce(result.context, {
      requireRegion: true,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.createMerchantProduct) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const title = getRequiredBodyString(body, "title");
    const productOptions = getOptionalBodyProductOptions(body);

    if (!title) {
      return context.json({ error: "missing_title" }, 400);
    }

    const product = await options.createMerchantProduct({
      title,
      description: getOptionalBodyString(body, "description"),
      handle: getOptionalBodyString(body, "handle"),
      collectionId: getOptionalBodyString(body, "collectionId"),
      categoryIds: getOptionalBodyStringArray(body, "categoryIds"),
      imageUrls: getOptionalBodyStringArray(body, "imageUrls"),
      ...(productOptions ? { options: productOptions } : {}),
      priceAmount: getOptionalBodyNumber(body, "priceAmount"),
      currencyCode: getOptionalBodyString(body, "currencyCode") ?? "etb",
      regionId: commerce.context.medusaRegionId,
      status: getOptionalBodyString(body, "status"),
      ...(result.context.medusaStockLocationId
        ? { stockLocationId: result.context.medusaStockLocationId }
        : {}),
      thumbnail: getOptionalBodyString(body, "thumbnail"),
      salesChannelId: commerce.context.medusaSalesChannelId,
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

    const commerce = getResolvedCommerce(result.context);

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.listMerchantProducts) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const products = await options.listMerchantProducts({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      salesChannelId: commerce.context.medusaSalesChannelId,
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

    const commerce = getResolvedCommerce(merchant.result.context);

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.getMerchantProduct) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const product = await options.getMerchantProduct({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
    });
  });

  app.get("/platform/merchant/product-categories", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    if (!options.listMerchantProductCategories) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const categories = await options.listMerchantProductCategories({
      limit: getPaginationValue(context.req.query("limit"), 100, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      tenantId: merchant.result.context.tenantId,
    });

    if (!categories.ok) {
      return context.json({ error: categories.error }, categories.status);
    }

    return context.json({
      categories: categories.categories,
      count: categories.count,
      limit: categories.limit,
      offset: categories.offset,
    });
  });

  app.post("/platform/merchant/product-categories", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    if (!options.createMerchantProductCategory) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const name = getRequiredBodyString(body, "name");

    if (!name) {
      return context.json({ error: "missing_name" }, 400);
    }

    const category = await options.createMerchantProductCategory({
      name,
      handle: getOptionalBodyString(body, "handle"),
      tenantId: merchant.result.context.tenantId,
    });

    if (!category.ok) {
      return context.json({ error: category.error }, category.status);
    }

    return context.json({
      category: category.category,
    });
  });

  app.get("/platform/merchant/product-collections", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    if (!options.listMerchantProductCollections) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const collections = await options.listMerchantProductCollections({
      limit: getPaginationValue(context.req.query("limit"), 100, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      tenantId: merchant.result.context.tenantId,
    });

    if (!collections.ok) {
      return context.json({ error: collections.error }, collections.status);
    }

    return context.json({
      collections: collections.collections,
      count: collections.count,
      limit: collections.limit,
      offset: collections.offset,
    });
  });

  app.post("/platform/merchant/product-collections", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    if (!options.createMerchantProductCollection) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const title = getRequiredBodyString(body, "title");

    if (!title) {
      return context.json({ error: "missing_title" }, 400);
    }

    const collection = await options.createMerchantProductCollection({
      title,
      handle: getOptionalBodyString(body, "handle"),
      tenantId: merchant.result.context.tenantId,
    });

    if (!collection.ok) {
      return context.json({ error: collection.error }, collection.status);
    }

    return context.json({
      collection: collection.collection,
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

    const commerce = getResolvedCommerce(result.context, {
      requireStockLocation: true,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.getMerchantProductStock) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const stockLocationId = commerce.context.medusaStockLocationId;

    if (!stockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const stock = await options.getMerchantProductStock({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId,
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

    const commerce = getResolvedCommerce(result.context, {
      requireStockLocation: true,
    });

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
    }

    if (!options.updateMerchantProductStock) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const stockedQuantity = getOptionalBodyNumber(body, "stockedQuantity");

    if (stockedQuantity === undefined || stockedQuantity < 0) {
      return context.json({ error: "invalid_stocked_quantity" }, 400);
    }

    const stockLocationId = commerce.context.medusaStockLocationId;

    if (!stockLocationId) {
      return context.json({ error: "inventory_location_unavailable" }, 503);
    }

    const stock = await options.updateMerchantProductStock({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
      stockLocationId,
      stockedQuantity,
    });

    if (!stock.ok) {
      return context.json({ error: stock.error }, stock.status);
    }

    return context.json({
      stock: stock.stock,
    });
  });

  app.get(
    "/platform/merchant/products/:productId/variants/:variantId/stock",
    async (context) => {
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

      const commerce = getResolvedCommerce(result.context, {
        requireStockLocation: true,
      });

      if (!commerce.ok) {
        return context.json({ error: commerce.error }, commerce.status);
      }

      if (!options.getMerchantProductVariantStock) {
        return context.json({ error: "commerce_backend_unavailable" }, 503);
      }

      const stockLocationId = commerce.context.medusaStockLocationId;

      if (!stockLocationId) {
        return context.json({ error: "inventory_location_unavailable" }, 503);
      }

      const stock = await options.getMerchantProductVariantStock({
        productId: context.req.param("productId"),
        salesChannelId: commerce.context.medusaSalesChannelId,
        stockLocationId,
        variantId: context.req.param("variantId"),
      });

      if (!stock.ok) {
        return context.json({ error: stock.error }, stock.status);
      }

      return context.json({
        stock: stock.stock,
      });
    },
  );

  app.post(
    "/platform/merchant/products/:productId/variants/:variantId/stock",
    async (context) => {
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

      const commerce = getResolvedCommerce(result.context, {
        requireStockLocation: true,
      });

      if (!commerce.ok) {
        return context.json({ error: commerce.error }, commerce.status);
      }

      if (!options.updateMerchantProductVariantStock) {
        return context.json({ error: "commerce_backend_unavailable" }, 503);
      }

      const body = await getJsonBody(context.req.raw);
      const stockedQuantity = getOptionalBodyNumber(body, "stockedQuantity");

      if (
        stockedQuantity === undefined ||
        stockedQuantity < 0 ||
        !Number.isInteger(stockedQuantity)
      ) {
        return context.json({ error: "invalid_stocked_quantity" }, 400);
      }

      const stockLocationId = commerce.context.medusaStockLocationId;

      if (!stockLocationId) {
        return context.json({ error: "inventory_location_unavailable" }, 503);
      }

      const stock = await options.updateMerchantProductVariantStock({
        productId: context.req.param("productId"),
        salesChannelId: commerce.context.medusaSalesChannelId,
        stockLocationId,
        stockedQuantity,
        variantId: context.req.param("variantId"),
      });

      if (!stock.ok) {
        return context.json({ error: stock.error }, stock.status);
      }

      return context.json({
        stock: stock.stock,
      });
    },
  );

  app.post("/platform/merchant/products/batch-delete", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProductsBatch)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

    const body = await getJsonBody(context.req.raw);
    const productIds = getOptionalBodyStringArray(body, "productIds");
    if (!productIds || productIds.length === 0)
      return context.json({ error: "invalid_product_ids" }, 400);

    const result = await options.deleteMerchantProductsBatch({
      productIds,
      salesChannelId: commerce.context.medusaSalesChannelId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
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

    const commerce = getResolvedCommerce(result.context);

    if (!commerce.ok) {
      return context.json({ error: commerce.error }, commerce.status);
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
      imageUrls: getOptionalBodyStringArray(body, "imageUrls"),
      status: getOptionalBodyString(body, "status"),
      thumbnail: getOptionalBodyString(body, "thumbnail"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
    });
  });

  app.delete("/platform/merchant/products/:productId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProduct)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

    const result = await options.deleteMerchantProduct({
      productId: context.req.param("productId"),
      salesChannelId: commerce.context.medusaSalesChannelId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.delete("/platform/merchant/product-categories/:categoryId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProductCategory)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

    const result = await options.deleteMerchantProductCategory({
      categoryId: context.req.param("categoryId"),
      tenantId: merchant.result.context.tenantId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.post("/platform/merchant/product-categories/batch-delete", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProductCategoriesBatch)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

    const body = await getJsonBody(context.req.raw);
    const categoryIds = getOptionalBodyStringArray(body, "categoryIds");
    if (!categoryIds || categoryIds.length === 0)
      return context.json({ error: "invalid_category_ids" }, 400);

    const result = await options.deleteMerchantProductCategoriesBatch({
      categoryIds,
      tenantId: merchant.result.context.tenantId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.delete("/platform/merchant/product-collections/:collectionId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProductCollection)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

    const result = await options.deleteMerchantProductCollection({
      collectionId: context.req.param("collectionId"),
      tenantId: merchant.result.context.tenantId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.post("/platform/merchant/product-collections/batch-delete", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const commerce = getResolvedCommerce(merchant.result.context);
    if (!commerce.ok) return context.json({ error: commerce.error }, commerce.status);
    if (!options.deleteMerchantProductCollectionsBatch)
      return context.json({ error: "commerce_backend_unavailable" }, 503);

    const body = await getJsonBody(context.req.raw);
    const collectionIds = getOptionalBodyStringArray(body, "collectionIds");
    if (!collectionIds || collectionIds.length === 0)
      return context.json({ error: "invalid_collection_ids" }, 400);

    const result = await options.deleteMerchantProductCollectionsBatch({
      collectionIds,
      tenantId: merchant.result.context.tenantId,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });
}

function getOptionalBodyProductOptions(body: unknown) {
  if (!body || typeof body !== "object" || !("options" in body)) {
    return undefined;
  }

  const options = (body as { options?: unknown }).options;

  if (!Array.isArray(options)) {
    return undefined;
  }

  return options.flatMap((option) => {
    if (!option || typeof option !== "object") {
      return [];
    }

    const title =
      typeof (option as { title?: unknown }).title === "string"
        ? (option as { title: string }).title.trim()
        : "";
    const values = Array.isArray((option as { values?: unknown }).values)
      ? (option as { values: unknown[] }).values
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    return title && values.length ? [{ title, values }] : [];
  });
}
