import type { createPlatformDb } from "@ecs/db";
import { dailyMetrics } from "@ecs/db";
import { and, eq, gte, inArray } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const seriesMetricKeys = ["overview.revenue", "overview.orders", "overview.customers"] as const;
const statusMetricKeys = [
  "overview.order_status",
  "overview.payment_status",
  "overview.fulfillment_status",
] as const;
const totalMetricKeys = [
  "overview.products",
  "overview.attention.unfulfilled",
  "overview.attention.unpaid",
  "overview.attention.draft_products",
] as const;

export type DashboardMetricSeriesRow = {
  customers: number;
  date: string;
  orders: number;
  revenue: number;
};

export type DashboardMetricsResult = {
  ok: true;
  metrics: {
    attention: {
      draftProducts: number | null;
      unfulfilledOrders: number | null;
      unpaidOrders: number | null;
    };
    breakdowns: {
      fulfillmentStatus: Array<{ count: number; label: string }>;
      orderStatus: Array<{ count: number; label: string }>;
      paymentStatus: Array<{ count: number; label: string }>;
    };
    currencyCode: string;
    products: number | null;
    series: DashboardMetricSeriesRow[];
  };
};

export function createDashboardMetricsService(db: PlatformDb) {
  return async function getDashboardMetrics(input: {
    days: number;
    tenantId: string;
  }): Promise<DashboardMetricsResult> {
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - Math.max(input.days - 1, 0));
    const fromDate = from.toISOString().slice(0, 10);

    const rows = await db
      .select({
        date: dailyMetrics.date,
        dimensionKey: dailyMetrics.dimensionKey,
        dimensionValue: dailyMetrics.dimensionValue,
        metricKey: dailyMetrics.metricKey,
        value: dailyMetrics.value,
      })
      .from(dailyMetrics)
      .where(
        and(
          eq(dailyMetrics.tenantId, input.tenantId),
          gte(dailyMetrics.date, fromDate),
          inArray(dailyMetrics.metricKey, [
            ...seriesMetricKeys,
            ...statusMetricKeys,
            ...totalMetricKeys,
          ]),
        ),
      );

    const byDate = new Map<string, DashboardMetricSeriesRow>();
    const breakdowns = {
      fulfillmentStatus: new Map<string, number>(),
      orderStatus: new Map<string, number>(),
      paymentStatus: new Map<string, number>(),
    };
    const attention = {
      draftProducts: null as number | null,
      unfulfilledOrders: null as number | null,
      unpaidOrders: null as number | null,
    };
    let products: number | null = null;

    for (const row of rows) {
      const value = Number(row.value);

      if (!Number.isFinite(value)) {
        continue;
      }

      if (seriesMetricKeys.includes(row.metricKey as (typeof seriesMetricKeys)[number])) {
        const bucket = byDate.get(row.date) ?? {
          customers: 0,
          date: row.date,
          orders: 0,
          revenue: 0,
        };

        if (row.metricKey === "overview.revenue") {
          bucket.revenue = value;
        } else if (row.metricKey === "overview.orders") {
          bucket.orders = Math.round(value);
        } else if (row.metricKey === "overview.customers") {
          bucket.customers = Math.round(value);
        }

        byDate.set(row.date, bucket);
        continue;
      }

      if (row.metricKey === "overview.order_status" && row.dimensionValue) {
        addBreakdown(breakdowns.orderStatus, row.dimensionValue, value);
      } else if (row.metricKey === "overview.payment_status" && row.dimensionValue) {
        addBreakdown(breakdowns.paymentStatus, row.dimensionValue, value);
      } else if (row.metricKey === "overview.fulfillment_status" && row.dimensionValue) {
        addBreakdown(breakdowns.fulfillmentStatus, row.dimensionValue, value);
      } else if (row.metricKey === "overview.products") {
        products = Math.round(value);
      } else if (row.metricKey === "overview.attention.unfulfilled") {
        attention.unfulfilledOrders = Math.round(value);
      } else if (row.metricKey === "overview.attention.unpaid") {
        attention.unpaidOrders = Math.round(value);
      } else if (row.metricKey === "overview.attention.draft_products") {
        attention.draftProducts = Math.round(value);
      }
    }

    return {
      ok: true,
      metrics: {
        attention,
        breakdowns: {
          fulfillmentStatus: toBreakdownRows(breakdowns.fulfillmentStatus),
          orderStatus: toBreakdownRows(breakdowns.orderStatus),
          paymentStatus: toBreakdownRows(breakdowns.paymentStatus),
        },
        currencyCode: "ETB",
        products,
        series: [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)),
      },
    };
  };
}

function addBreakdown(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + Math.round(value));
}

function toBreakdownRows(map: Map<string, number>) {
  return [...map.entries()]
    .sort(([, left], [, right]) => right - left)
    .map(([label, count]) => ({ label, count }));
}
