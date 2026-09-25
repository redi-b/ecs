"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "@/components/app/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMoney, formatNumber } from "./overview-helpers";
import { metricIntervals, metricSplit, type MetricDay } from "./metric-insights";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";

type Detail = { label: string; value: string };
type Mark = { id: string; value: number | null };

function MiniMetric({
  label,
  value,
  scope,
  caption,
  href,
  marks,
  kind,
  details,
}: {
  label: string;
  value: string;
  scope: string;
  caption: string;
  href: string;
  marks: Mark[];
  kind: "fingerprint" | "activity" | "split";
  details: Detail[];
}) {
  const maximum = Math.max(1, ...marks.map((mark) => mark.value ?? 0));
  const total = marks.reduce((sum, mark) => sum + (mark.value ?? 0), 0);
  return (
    <section className="min-w-0 px-4 py-3.5" aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Link
          href={href}
          prefetch={false}
          className="min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
        >
          <span className="block text-xs text-muted-foreground">{label}</span>
          <span className="mt-1 block font-mono text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
            {value}
          </span>
        </Link>
        {marks.some((mark) => mark.value != null) ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`${label}: ${caption}`}
                className="group flex h-11 w-24 shrink-0 items-center rounded-sm px-1 text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                <span
                  aria-hidden="true"
                  className={`flex w-full items-end ${kind === "split" ? "h-3 gap-1" : "h-7 gap-[2px]"}`}
                >
                  {marks.map((mark) => (
                    <span
                      key={mark.id}
                      className={
                        kind === "split"
                          ? `h-full rounded-[2px] ${mark.id === "draft" || mark.id === "repeat" ? "bg-primary" : mark.id === "proposed" ? "bg-primary/50" : mark.id === "rejected" ? "bg-muted-foreground/50" : "bg-primary/20"}`
                          : mark.value == null
                            ? "flex-1 self-center border-t border-dashed border-muted-foreground/40"
                            : kind === "activity"
                              ? "h-2 flex-1 self-center rounded-[2px] bg-primary"
                              : "flex-1 rounded-t-[1px] bg-primary"
                      }
                      style={
                        kind === "split"
                          ? {
                              width: `${total > 0 ? ((mark.value ?? 0) / total) * 100 : 0}%`,
                              display: mark.value === 0 ? "none" : undefined,
                            }
                          : kind === "activity"
                            ? {
                                opacity:
                                  mark.value == null
                                    ? 1
                                    : mark.value === 0
                                      ? 0.12
                                      : 0.3 + (mark.value / maximum) * 0.7,
                              }
                            : {
                                height:
                                  mark.value == null
                                    ? undefined
                                    : `${Math.max(5, (mark.value / maximum) * 100)}%`,
                                opacity: mark.value === 0 ? 0.2 : 1,
                              }
                      }
                    />
                  ))}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 gap-3 p-4" aria-label={label}>
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{scope}</p>
              </div>
              <dl className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-3 text-xs [scrollbar-gutter:stable]">
                {details.map((detail) => (
                  <div key={detail.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{detail.label}</dt>
                    <dd className="text-right font-mono tabular-nums">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </PopoverContent>
          </Popover>
        ) : (
          <span
            aria-hidden="true"
            className="flex h-11 w-24 shrink-0 items-center justify-center text-lg text-muted-foreground/40"
          >
            —
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{scope}</p>
      <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
    </section>
  );
}

export function OverviewKpiStrip({
  operations,
  rows,
  range,
  rangeLabel,
  currencyCode,
  previewHref,
}: {
  operations: MerchantDashboardSummary["operations"];
  rows: readonly MetricDay[];
  range: { start: string; end: string } | null;
  rangeLabel: string;
  currencyCode: string;
  previewHref: (href: string) => string;
}) {
  const { t, locale, formatDate } = useI18n();
  const reported = (operations?.series.length ?? 0) > 0;
  const number = (value: number | null | undefined) => formatNumber(value, locale);
  const money = (value: number | null | undefined) => formatMoney(value, currencyCode, locale);
  const total = rows.reduce(
    (sum, row) => ({ revenue: sum.revenue + row.revenue, orders: sum.orders + row.orders }),
    { revenue: 0, orders: 0 },
  );
  // A fresh full-history rollup is sparse: absent days inside its bounds had no orders.
  // Do not make that assumption for missing/stale reports or outside known coverage.
  const firstDay = operations?.series[0]?.date;
  const lastDay = operations?.series.at(-1)?.date;
  const coverage =
    operations?.quality.status === "fresh" && firstDay && lastDay
      ? {
          start: firstDay,
          end: lastDay,
        }
      : undefined;
  const revenue = metricIntervals(rows, range, "revenue", 24, coverage);
  const orders = metricIntervals(rows, range, "orders", 24, coverage);
  const intervalLabel = (interval: { start: string; end: string }) =>
    interval.start === interval.end
      ? formatDate(interval.start)
      : `${formatDate(interval.start)} – ${formatDate(interval.end)}`;
  const strongest = revenue.reduce<(typeof revenue)[number] | null>(
    (best, item) => (item.value != null && item.value > (best?.value ?? 0) ? item : best),
    null,
  );
  const productStatuses = operations?.productStatuses?.filter((row) => row.count > 0) ?? [];
  const customerSplit = metricSplit(operations?.customers.unique, operations?.customers.repeat);
  const unavailable = t("overview.metrics.detailUnavailable");
  const allTime = t("overview.trading.range.all");
  return (
    <div data-slot="overview-metrics" className="grid sm:grid-cols-2 xl:grid-cols-4">
      <MiniMetric
        label={t("overview.metrics.revenue")}
        href={previewHref(dashboardRoutes.orders)}
        value={money(reported ? total.revenue : operations?.totals.revenue)}
        scope={reported ? rangeLabel : allTime}
        caption={
          strongest
            ? t("overview.metrics.strongest", { date: intervalLabel(strongest) })
            : (reported && total.revenue === 0) || operations?.totals.revenue === 0
              ? t("overview.metrics.noRevenue")
              : unavailable
        }
        kind="fingerprint"
        marks={reported ? revenue.map((item) => ({ id: item.start, value: item.value })) : []}
        details={revenue.map((item) => ({
          label: intervalLabel(item),
          value: item.value == null ? unavailable : money(item.value),
        }))}
      />
      <MiniMetric
        label={t("overview.metrics.orders")}
        href={previewHref(dashboardRoutes.orders)}
        value={number(reported ? total.orders : operations?.totals.orders)}
        scope={reported ? rangeLabel : allTime}
        caption={
          reported && rows.length > 0
            ? t("overview.metrics.activeDays", {
                count: rows.filter((row) => row.orders > 0).length,
              })
            : (reported && total.orders === 0) || operations?.totals.orders === 0
              ? t("overview.metrics.noOrders")
              : unavailable
        }
        kind="activity"
        marks={reported ? orders.map((item) => ({ id: item.start, value: item.value })) : []}
        details={orders.map((item) => ({
          label: intervalLabel(item),
          value: item.value == null ? unavailable : number(item.value),
        }))}
      />
      <MiniMetric
        label={t("overview.metrics.products")}
        href={previewHref(dashboardRoutes.products)}
        value={number(operations?.totals.products)}
        scope={t("overview.metrics.catalogCount")}
        caption={
          operations?.totals.products === 0
            ? t("overview.metrics.noProducts")
            : operations?.attention.draftProducts != null
              ? t("overview.metrics.draftCount", { count: operations.attention.draftProducts })
              : unavailable
        }
        kind="split"
        marks={productStatuses.map((row) => ({ id: row.status, value: row.count }))}
        details={productStatuses.map((row) => ({
          label: t(`overview.metrics.productStatus.${row.status}`),
          value: number(row.count),
        }))}
      />
      <MiniMetric
        label={t("overview.metrics.customers")}
        href={previewHref(dashboardRoutes.customers)}
        value={number(operations?.customers.unique)}
        scope={allTime}
        caption={
          customerSplit
            ? t("overview.metrics.returningCount", {
                count: number(customerSplit.subset),
                first: number(customerSplit.rest),
              })
            : operations?.customers.unique === 0
              ? t("overview.metrics.noCustomers")
              : unavailable
        }
        kind="split"
        marks={
          customerSplit
            ? [
                { id: "repeat", value: customerSplit.subset },
                { id: "once", value: customerSplit.rest },
              ]
            : []
        }
        details={
          customerSplit
            ? [
                { label: t("overview.metrics.returning"), value: number(customerSplit.subset) },
                { label: t("overview.metrics.oneOrder"), value: number(customerSplit.rest) },
              ]
            : []
        }
      />
    </div>
  );
}
