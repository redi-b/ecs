import type {
  BillingStatus,
  DashboardMetricsResult,
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
    supportAccess?: { grantId: string; expiresAt: string };
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
    hasUnpublishedChanges?: boolean;
    publishedRevisionId: string | null;
    publishedTemplateKey?: string | null;
    savedTemplateKeys?: string[];
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
  type DashboardContextInput = {
    domainId: string;
    hostname: string;
    medusaPublishableKeyId: string | null;
    medusaRegionId: string | null;
    medusaSalesChannelId: string | null;
    medusaStockLocationId: string | null;
    medusaStoreId: string | null;
    publishedRevisionId: string | null;
    publishedTemplateKey: string | null;
    hasUnpublishedChanges?: boolean;
    savedTemplateKeys?: string[];
    status: string;
    templateId: string | null;
    templateKey: string | null;
    templateVersion: number | null;
    tenantHandle: string;
    tenantId: string;
    tenantName: string;
  };

  function buildMerchantDashboardBase(input: {
    actor: MerchantDashboardBase["actor"];
    context: DashboardContextInput;
  }): MerchantDashboardBase {
    return {
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
        hasUnpublishedChanges: input.context.hasUnpublishedChanges ?? false,
        publishedRevisionId: input.context.publishedRevisionId,
        publishedTemplateKey: input.context.publishedTemplateKey,
        savedTemplateKeys: input.context.savedTemplateKeys ?? [],
        templateId: input.context.templateId,
        templateKey: input.context.templateKey,
        templateVersion: input.context.templateVersion,
      },
    };
  }

  /** Auth/shell only — no Medusa order sampling, metrics, or billing. */
  async function getMerchantDashboardAccessPayload(input: {
    actor: MerchantDashboardBase["actor"];
    context: DashboardContextInput;
  }) {
    return buildMerchantDashboardBase(input);
  }

  async function getMerchantDashboardPayload(input: {
    actor: MerchantDashboardBase["actor"];
    context: DashboardContextInput;
  }) {
    const base = buildMerchantDashboardBase(input);
    const commerce = getResolvedCommerce(input.context);
    const commerceContext = commerce.ok ? commerce.context : null;

    // Ops / analytics / billing are independent — run together for Overview TTFB.
    const [operations, analytics, billing] = await Promise.all([
      getDashboardOperations({
        commerce: commerceContext,
        tenantId: input.context.tenantId,
      }),
      getDashboardAnalytics({ tenantId: input.context.tenantId }),
      getDashboardBilling({ tenantId: input.context.tenantId }),
    ]);

    return {
      ...base,
      operations,
      analytics,
      billing,
    };
  }

  async function getDashboardOperations(input: {
    commerce: ResolvedMerchantCommerceContext | null;
    tenantId: string;
  }) {
    const unavailable: string[] = [];

    // Prefer platform daily_metrics (cheap DB) before heavy Medusa list calls.
    const metrics = options.getDashboardMetrics
      ? await options.getDashboardMetrics({ days: 90, tenantId: input.tenantId })
      : null;
    const metricData = metrics?.ok ? metrics.metrics : null;
    const useMetricOperations = Boolean(metricData && metricData.quality.status !== "missing");

    // With metrics: only need a handful of recent orders for the list strip.
    // Without metrics: sample more for charts (still less than the old 90).
    const orderLimit = useMetricOperations ? 8 : 45;
    const needProductSample = metricData?.products == null;

    const [orders, products] = await Promise.all([
      input.commerce && options.listMerchantOrders
        ? options.listMerchantOrders({
            limit: orderLimit,
            offset: 0,
            salesChannelId: input.commerce.medusaSalesChannelId,
          })
        : Promise.resolve(null),
      input.commerce && options.listMerchantProducts && needProductSample
        ? options.listMerchantProducts({
            limit: 5,
            offset: 0,
            salesChannelId: input.commerce.medusaSalesChannelId,
          })
        : Promise.resolve(null),
    ]);

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
    const currencyCode = orderRows.find((order) => order.currencyCode)?.currencyCode ?? null;
    const metricTotals = metricData ? getMetricTotals(metricData) : null;

    return {
      range: {
        label: useMetricOperations ? "Last 90 days" : "Recent orders",
        days: 90,
        sampledOrderCount: useMetricOperations ? (metricTotals?.orders ?? 0) : orderRows.length,
      },
      quality: metricData?.quality ?? {
        lastSuccessfulAt: null,
        rollupVersion: 1,
        status: "missing" as const,
        timezone: "Africa/Addis_Ababa",
        watermark: null,
      },
      totals: {
        revenue: useMetricOperations ? (metricTotals?.revenue ?? null) : null,
        orders: useMetricOperations
          ? (metricTotals?.orders ?? null)
          : orders?.ok
            ? orders.count
            : null,
        products: metricData?.products ?? (products?.ok ? products.count : null),
        customers: null,
        currencyCode: useMetricOperations ? (metricData?.currencyCode ?? null) : currencyCode,
      },
      attention: {
        unfulfilledOrders: useMetricOperations
          ? (metricData?.attention.unfulfilledOrders ?? null)
          : null,
        unpaidOrders: useMetricOperations ? (metricData?.attention.unpaidOrders ?? null) : null,
        draftProducts: metricData?.attention.draftProducts ?? null,
      },
      customers: {
        unique: useMetricOperations ? (metricData?.customers.unique ?? null) : null,
        repeat: useMetricOperations ? (metricData?.customers.repeat ?? null) : null,
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
      series: useMetricOperations ? (metricData?.series ?? []) : [],
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
        orders: total.orders + row.orders,
        revenue: total.revenue + row.revenue,
      }),
      {
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
        funnel: [],
        storefront: {
          addToCartVisits: 0,
          checkoutVisits: 0,
          contactVisits: 0,
          pageViews: 0,
          productViewVisits: 0,
          searchVisits: 0,
          visits: 0,
        },
        products: [],
        coverage: {
          lastEventAt: null,
          status: "no_data" as const,
        },
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
      funnel: result.summary.funnel,
      storefront: result.summary.storefront,
      products: result.summary.products,
      coverage: result.summary.coverage,
      unavailable: false,
    };
  }

  async function getDashboardBilling(input: { tenantId: string }) {
    if (!options.getBillingStatus) {
      return {
        subscription: null,
        plan: null,
        invoices: [],
        availablePaidPlans: [],
        catalog: [],
        unavailable: true,
      };
    }

    const result = await options.getBillingStatus({ tenantId: input.tenantId });

    if (!result.ok) {
      return {
        subscription: null,
        plan: null,
        invoices: [],
        availablePaidPlans: [],
        catalog: [],
        unavailable: true,
      };
    }

    return serializeBilling(result.billing);
  }

  function serializeBilling(billing: BillingStatus) {
    return {
      entitlements: billing.entitlements,
      subscription: billing.subscription,
      plan: billing.plan,
      invoices: billing.invoices,
      availablePaidPlans: billing.availablePaidPlans ?? [],
      catalog: billing.catalog ?? [],
      unavailable: false,
    };
  }

  return { getMerchantDashboardAccessPayload, getMerchantDashboardPayload };
}
