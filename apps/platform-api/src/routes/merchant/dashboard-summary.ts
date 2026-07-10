import type {
  BillingStatus,
  DashboardMetricsResult,
  MerchantOrder,
  PlatformAppOptions,
  TenantInsightsSummaryResult,
} from "../../app.js";
import type { ResolvedMerchantCommerceContext } from "./context.js";

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

export function createMerchantDashboardSummary(
  options: PlatformAppOptions,
  getResolvedCommerce: (
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
  ) =>
    | { ok: true; context: ResolvedMerchantCommerceContext }
    | {
        ok: false;
        error:
          | "commerce_store_unavailable"
          | "commerce_sales_channel_unavailable"
          | "inventory_location_unavailable"
          | "commerce_region_unavailable";
        status: 503;
      },
) {
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

  return { getMerchantDashboardPayload };
}
