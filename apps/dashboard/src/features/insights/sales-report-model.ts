import type { InsightsSalesReport } from "@ecs/contracts";

export type SalesMeasure = "orders" | "paidOrderValue";
export type SalesInterval = "day" | "week";
export type SalesBucket = {
  from: string;
  to: string;
  previousFrom: string | null;
  previousTo: string | null;
  current: number | null;
  previous: number | null;
};

/** Equal-length, range-relative buckets keep current and previous samples aligned. */
export function salesBuckets(
  report: InsightsSalesReport,
  measure: SalesMeasure,
  interval: SalesInterval,
): SalesBucket[] {
  const size = interval === "week" ? 7 : 1;
  const buckets: SalesBucket[] = [];
  const previousKey = measure === "orders" ? "previousOrders" : "previousPaidOrderValue";
  for (let start = 0; start < report.series.length; start += size) {
    const points = report.series.slice(start, start + size);
    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) continue;
    const sum = (key: SalesMeasure | typeof previousKey) =>
      points.some((p) => p[key] === null)
        ? null
        : points.reduce((total, p) => total + (p[key] ?? 0), 0);
    buckets.push({
      from: first.date,
      to: last.date,
      previousFrom: first.previousDate,
      previousTo: last.previousDate,
      current: sum(measure),
      previous: sum(previousKey),
    });
  }
  return buckets;
}

export function salesChange(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  return {
    amount: current - previous,
    percent: previous === 0 ? null : ((current - previous) / previous) * 100,
  };
}

export function defaultSalesRange(now: Date) {
  const today = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = shiftSalesDay(today, -1);
  return { from: shiftSalesDay(to, -29), to };
}

export function shiftSalesDay(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function reportCsv(report: InsightsSalesReport) {
  // Machine-readable headings are stable across locales; values contain no user content.
  return [
    [
      "date",
      "timezone",
      "currency",
      "orders",
      "paid_order_value",
      "previous_date",
      "previous_orders",
      "previous_paid_order_value",
    ].join(","),
    ...report.series.map((p) =>
      [
        p.date,
        report.timezone,
        report.currencyCode,
        p.orders,
        p.paidOrderValue,
        p.previousDate,
        p.previousOrders,
        p.previousPaidOrderValue,
      ]
        .map((value) => value ?? "")
        .join(","),
    ),
  ].join("\r\n");
}
