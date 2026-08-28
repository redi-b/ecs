import type { createPlatformDb } from "@ecs/db";
import { dailyMetrics, metricRollupCheckpoints } from "@ecs/db";
import { and, eq, gte, inArray } from "drizzle-orm";
import { COMMERCE_ROLLUP_KEY, COMMERCE_ROLLUP_VERSION } from "./commerce-rollup.js";
import {
  isRegisteredMetricKey,
  metricRegistry,
  type RegisteredMetricKey,
  registeredMetricKeys,
} from "./metric-registry.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const seriesMetricKeys = ["overview.revenue", "overview.orders", "overview.customers"] as const;

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
    customers: { repeat: number | null; unique: number | null };
    quality: DashboardMetricQuality;
    products: number | null;
    series: DashboardMetricSeriesRow[];
  };
};

export type DashboardMetricQuality = {
  lastSuccessfulAt: string | null;
  rollupVersion: number;
  status: "fresh" | "missing" | "stale";
  timezone: string;
  watermark: string | null;
};

export type DashboardMetricSourceRow = {
  computedAt?: Date | null;
  date: string;
  dimensionKey: string | null;
  dimensionValue: string | null;
  metricKey: string;
  value: string | number;
};

export function createDashboardMetricsService(
  db: PlatformDb,
  options?: { now?: () => Date; staleAfterMs?: number },
) {
  const now = options?.now ?? (() => new Date());
  const staleAfterMs = options?.staleAfterMs ?? 12 * 60 * 60 * 1000;
  return async function getDashboardMetrics(input: {
    days: number;
    tenantId: string;
  }): Promise<DashboardMetricsResult> {
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - Math.max(input.days - 1, 0));
    const fromDate = from.toISOString().slice(0, 10);

    const [rows, checkpoints] = await Promise.all([
      db
        .select({
          computedAt: dailyMetrics.computedAt,
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
            inArray(dailyMetrics.metricKey, registeredMetricKeys),
          ),
        ),
      db
        .select({
          lastSuccessfulAt: metricRollupCheckpoints.lastSuccessfulAt,
          rollupVersion: metricRollupCheckpoints.rollupVersion,
          timezone: metricRollupCheckpoints.timezone,
          watermark: metricRollupCheckpoints.watermark,
        })
        .from(metricRollupCheckpoints)
        .where(
          and(
            eq(metricRollupCheckpoints.tenantId, input.tenantId),
            eq(metricRollupCheckpoints.rollupKey, COMMERCE_ROLLUP_KEY),
            eq(metricRollupCheckpoints.rollupVersion, COMMERCE_ROLLUP_VERSION),
          ),
        )
        .limit(1),
    ]);

    return aggregateDashboardMetricRows(
      rows,
      classifyDashboardMetricQuality(checkpoints[0], { now: now(), staleAfterMs }),
    );
  };
}

export function aggregateDashboardMetricRows(
  sourceRows: DashboardMetricSourceRow[],
  quality: DashboardMetricQuality = missingMetricQuality(),
): DashboardMetricsResult {
  const latestSnapshotDate = new Map<RegisteredMetricKey, string>();
  for (const row of sourceRows) {
    if (!isRegisteredMetricKey(row.metricKey)) continue;
    if (metricRegistry[row.metricKey].kind !== "snapshot") continue;
    const current = latestSnapshotDate.get(row.metricKey);
    if (!current || row.date > current) latestSnapshotDate.set(row.metricKey, row.date);
  }

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
  const customers = { repeat: null as number | null, unique: null as number | null };

  for (const row of sourceRows) {
    const value = Number(row.value);

    if (!Number.isFinite(value) || !isRegisteredMetricKey(row.metricKey)) {
      continue;
    }

    if (
      metricRegistry[row.metricKey].kind === "snapshot" &&
      row.date !== latestSnapshotDate.get(row.metricKey)
    ) {
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
    } else if (row.metricKey === "overview.customers.unique") {
      customers.unique = Math.round(value);
    } else if (row.metricKey === "overview.customers.repeat") {
      customers.repeat = Math.round(value);
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
      customers,
      quality,
      products,
      series: [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)),
    },
  };
}

export function classifyDashboardMetricQuality(
  checkpoint:
    | {
        lastSuccessfulAt: Date;
        rollupVersion: number;
        timezone: string;
        watermark: Date;
      }
    | undefined,
  options: { now: Date; staleAfterMs: number },
): DashboardMetricQuality {
  if (!checkpoint) return missingMetricQuality();
  const age = options.now.getTime() - checkpoint.lastSuccessfulAt.getTime();
  return {
    lastSuccessfulAt: checkpoint.lastSuccessfulAt.toISOString(),
    rollupVersion: checkpoint.rollupVersion,
    status: age <= options.staleAfterMs ? "fresh" : "stale",
    timezone: checkpoint.timezone,
    watermark: checkpoint.watermark.toISOString(),
  };
}

function missingMetricQuality(): DashboardMetricQuality {
  return {
    lastSuccessfulAt: null,
    rollupVersion: COMMERCE_ROLLUP_VERSION,
    status: "missing",
    timezone: "Africa/Addis_Ababa",
    watermark: null,
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
