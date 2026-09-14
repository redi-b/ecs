import type { InsightsSalesQuery, InsightsSalesReport } from "@ecs/contracts";
import { insightsSalesQuerySchema } from "@ecs/contracts";
import {
  completeReportingCoverage,
  reportingDay,
  reportingDays,
  shiftReportingDay,
} from "./reporting-calendar.js";

export type SalesSource = {
  checkpoint: {
    lastSuccessfulAt: Date;
    timezone: string;
    metadata: unknown;
  } | null;
  rows: Array<{ date: string; metricKey: string; value: string | number }>;
};

export type ReadSalesSource = (input: {
  tenantId: string;
  from: string;
  to: string;
}) => Promise<SalesSource>;

export function createInsightsSalesService(
  read: ReadSalesSource,
  now: () => Date = () => new Date(),
) {
  return async (input: { tenantId: string; query: unknown }) => {
    const query = insightsSalesQuerySchema.safeParse(input.query);
    const generatedAt = now();
    if (
      !query.success ||
      query.data.from < "1970-01-01" ||
      query.data.from > query.data.to ||
      query.data.to >= reportingDay(generatedAt) ||
      reportingDays(query.data.from, query.data.to) > 366
    ) {
      return { ok: false as const, error: "insights_range_invalid", status: 400 as const };
    }
    const previousRange = comparisonRange(query.data);
    const source = await read({
      tenantId: input.tenantId,
      from: previousRange?.from ?? query.data.from,
      to: query.data.to,
    });
    return {
      ok: true as const,
      report: buildSalesReport({
        tenantId: input.tenantId,
        query: query.data,
        now: generatedAt,
        source,
      }),
    };
  };
}

export function comparisonRange(query: InsightsSalesQuery) {
  return query.comparison === "none"
    ? null
    : {
        from: shiftReportingDay(query.from, -reportingDays(query.from, query.to)),
        to: shiftReportingDay(query.from, -1),
      };
}

export function sourceCoverage(checkpoint: SalesSource["checkpoint"]) {
  if (!checkpoint || checkpoint.timezone !== "Africa/Addis_Ababa") return null;
  const metadata = checkpoint.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const values = metadata as Record<string, unknown>;
  if (
    values.currencyCode !== "ETB" ||
    typeof values.sourceWindowStart !== "string" ||
    typeof values.sourceWindowEnd !== "string"
  )
    return null;
  return completeReportingCoverage(
    new Date(values.sourceWindowStart),
    new Date(values.sourceWindowEnd),
  );
}

export function buildSalesReport(input: {
  tenantId: string;
  query: InsightsSalesQuery;
  now: Date;
  source: SalesSource;
}): InsightsSalesReport {
  const { query, source } = input;
  const coverage = sourceCoverage(source.checkpoint);
  const previousRange = comparisonRange(query);
  const rows = new Map<string, { orders: number; paidOrderValue: number }>();
  const invalidDays = new Set<string>();
  for (const row of source.rows) {
    if (row.metricKey !== "overview.orders" && row.metricKey !== "overview.revenue") continue;
    const value = Number(row.value);
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      (row.metricKey === "overview.orders" && !Number.isSafeInteger(value))
    ) {
      invalidDays.add(row.date);
      continue;
    }
    const day = rows.get(row.date) ?? { orders: 0, paidOrderValue: 0 };
    if (row.metricKey === "overview.orders") day.orders += value;
    else day.paidOrderValue += value;
    rows.set(row.date, day);
  }
  const valuesAt = (date: string) =>
    coverage && date >= coverage.from && date <= coverage.to && !invalidDays.has(date)
      ? (rows.get(date) ?? { orders: 0, paidOrderValue: 0 })
      : null;
  const series = Array.from({ length: reportingDays(query.from, query.to) }, (_, index) => {
    const date = shiftReportingDay(query.from, index);
    const previousDate = previousRange ? shiftReportingDay(previousRange.from, index) : null;
    const current = valuesAt(date);
    const previous = previousDate ? valuesAt(previousDate) : null;
    return {
      date,
      orders: current?.orders ?? null,
      paidOrderValue: current?.paidOrderValue ?? null,
      previousDate,
      previousOrders: previous?.orders ?? null,
      previousPaidOrderValue: previous?.paidOrderValue ?? null,
    };
  });
  const total = (previous: boolean) => {
    let orders = 0;
    let paidOrderValue = 0;
    for (const point of series) {
      const count = previous ? point.previousOrders : point.orders;
      const amount = previous ? point.previousPaidOrderValue : point.paidOrderValue;
      if (count === null || amount === null) return null;
      orders += count;
      paidOrderValue += amount;
    }
    return { orders, paidOrderValue };
  };
  return {
    tenantId: input.tenantId,
    generatedAt: input.now.toISOString(),
    timezone: "Africa/Addis_Ababa",
    currencyCode: "ETB",
    range: { from: query.from, to: query.to },
    previousRange,
    quality: {
      status: !coverage
        ? "missing"
        : input.now.getTime() - (source.checkpoint?.lastSuccessfulAt.getTime() ?? 0) >
            12 * 60 * 60 * 1000
          ? "stale"
          : "fresh",
      updatedAt: source.checkpoint?.lastSuccessfulAt.toISOString() ?? null,
      coverage,
    },
    totals: total(false),
    previousTotals: previousRange ? total(true) : null,
    series,
  };
}
