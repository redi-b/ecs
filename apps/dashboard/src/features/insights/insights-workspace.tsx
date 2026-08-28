"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { HelpTip } from "@/components/app/help-tip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/provider";

type InsightsWorkspaceProps = { summary: MerchantDashboardSummary };
type SalesPeriod = "30" | "90";

const funnelKeys = {
  storefront_visits: "insights.funnel.storefrontVisits",
  product_views: "insights.funnel.productViews",
  add_to_cart: "insights.funnel.addToCart",
  checkout_started: "insights.funnel.checkoutStarted",
  orders_created: "insights.funnel.ordersCreated",
} as const;

export function InsightsWorkspace({ summary }: InsightsWorkspaceProps) {
  const { locale, t } = useI18n();
  const revenueGradientId = useId();
  const [period, setPeriod] = useState<SalesPeriod>("30");
  const analytics = summary.analytics;
  const operations = summary.operations;
  const fullSeries = operations?.series ?? [];
  const days = Number(period);
  const series = useMemo(() => selectRecentSeries(fullSeries, days), [days, fullSeries]);
  const currency = operations?.totals.currencyCode?.toUpperCase() ?? "ETB";
  const totals = useMemo(
    () =>
      series.reduce(
        (result, point) => ({
          orders: result.orders + point.orders,
          revenue: result.revenue + point.revenue,
        }),
        { orders: 0, revenue: 0 },
      ),
    [series],
  );
  const averageOrder = totals.orders > 0 ? totals.revenue / totals.orders : null;
  const funnel = analytics?.unavailable ? [] : (analytics?.funnel ?? []);
  const busiestDay = useMemo(
    () =>
      series.reduce<(typeof series)[number] | null>(
        (best, point) => (!best || point.orders > best.orders ? point : best),
        null,
      ),
    [series],
  );
  const chartConfig = useMemo(
    () => ({
      revenue: { color: "var(--chart-1)", label: t("insights.sales.revenue") },
      orders: { color: "var(--chart-4)", label: t("insights.sales.orders") },
    }),
    [t],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <SegmentedControl
          active="muted"
          ariaLabel={t("insights.period.label")}
          className="min-w-[13.5rem]"
          fullWidth={false}
          onChange={setPeriod}
          options={[
            { id: "30", label: t("insights.period.thirtyDays") },
            { id: "90", label: t("insights.period.ninetyDays") },
          ]}
          size="sm"
          value={period}
        />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={t("insights.metrics.revenue")}
          value={formatMoney(totals.revenue, currency, locale)}
        />
        <Metric label={t("insights.metrics.orders")} value={formatNumber(totals.orders, locale)} />
        <Metric
          label={t("insights.metrics.averageOrder")}
          value={formatMoney(averageOrder, currency, locale)}
        />
        <StorefrontVisitsMetric initialValue={funnel[0]?.count ?? null} />
      </section>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{t("insights.sales.title")}</CardTitle>
          <CardDescription>{t("insights.sales.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {series.length ? (
            <ChartContainer className="h-[320px] w-full" config={chartConfig}>
              <ComposedChart accessibilityLayer data={series} margin={{ left: 4, right: 4 }}>
                <defs>
                  <linearGradient id={revenueGradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.36} />
                    <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 7" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="date"
                  minTickGap={28}
                  tickFormatter={(value) => shortDate(value, locale)}
                  tickLine={false}
                />
                <YAxis hide yAxisId="revenue" />
                <YAxis hide orientation="right" yAxisId="orders" />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) =>
                        name === "revenue"
                          ? formatMoney(Number(value), currency, locale)
                          : formatNumber(Number(value), locale)
                      }
                      labelFormatter={(value) => longDate(String(value), locale)}
                    />
                  }
                />
                <Area
                  dataKey="revenue"
                  fill={`url(#${revenueGradientId})`}
                  stroke="var(--color-revenue)"
                  strokeWidth={2.5}
                  type="monotone"
                  yAxisId="revenue"
                />
                <Bar
                  dataKey="orders"
                  fill="var(--color-orders)"
                  fillOpacity={0.34}
                  maxBarSize={12}
                  radius={[4, 4, 0, 0]}
                  yAxisId="orders"
                />
              </ComposedChart>
            </ChartContainer>
          ) : (
            <EmptyState
              description={t("insights.sales.emptyDescription")}
              title={t("insights.sales.emptyTitle")}
            />
          )}
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <CardTitle>{t("insights.funnel.title")}</CardTitle>
                  <HelpTip
                    summary={t("insights.funnel.disclaimer")}
                    title={t("insights.funnel.helpTitle")}
                  />
                </div>
                <CardDescription>{t("insights.funnel.description")}</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">
                {t("insights.period.thirtyDays")}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {funnel.length ? (
              <JourneyStages stages={funnel} />
            ) : (
              <EmptyState
                description={t("insights.funnel.emptyDescription")}
                title={t("insights.funnel.emptyTitle")}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("insights.highlights.title")}</CardTitle>
            <CardDescription>{t("insights.highlights.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Highlight
              label={t("insights.highlights.busiestDay")}
              value={
                busiestDay && busiestDay.orders > 0
                  ? t("insights.highlights.ordersOnDate", {
                      count: formatNumber(busiestDay.orders, locale),
                      date: longDateOnly(busiestDay.date, locale),
                    })
                  : t("insights.highlights.noSales")
              }
            />
            <Highlight
              label={t("insights.highlights.returningCustomers")}
              value={
                typeof operations?.customers.repeat === "number"
                  ? formatNumber(operations.customers.repeat, locale)
                  : t("insights.highlights.notAvailable")
              }
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function JourneyStages({
  stages,
}: {
  stages: NonNullable<MerchantDashboardSummary["analytics"]>["funnel"];
}) {
  const { formatNumber, t } = useI18n();
  const max = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <ol className="flex flex-col divide-y">
      {stages.map((stage, index) => (
        <li
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 first:pt-0 last:pb-0"
          key={stage.key}
        >
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium">{t(funnelKeys[stage.key])}</p>
              <span className="text-xs text-muted-foreground">
                {t(
                  index === stages.length - 1
                    ? "insights.funnel.ordersUnit"
                    : "insights.funnel.sessionsUnit",
                )}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-[var(--ease-dashboard)]"
                style={{ width: `${Math.max(stage.count ? 4 : 0, (stage.count / max) * 100)}%` }}
              />
            </div>
          </div>
          <p className="min-w-10 text-right text-lg font-semibold tabular-nums">
            {formatNumber(stage.count)}
          </p>
        </li>
      ))}
    </ol>
  );
}

function StorefrontVisitsMetric({ initialValue }: { initialValue: number | null }) {
  const { formatNumber, t } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);

  async function refresh() {
    setPending(true);
    const response = await fetch("/admin/insights/actions/visits", {
      cache: "no-store",
      headers: { accept: "application/json" },
    }).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as { visits?: number };
    if (response?.ok && typeof data.visits === "number") {
      setValue(data.visits);
      router.refresh();
      toast.success(t("insights.visits.updated"));
    } else {
      toast.error(t("insights.visits.error"));
    }
    setPending(false);
  }

  return (
    <Metric
      action={
        <Button
          aria-label={t("insights.visits.refresh")}
          disabled={pending}
          onClick={() => void refresh()}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <RefreshCwIcon className={pending ? "animate-spin" : undefined} />
        </Button>
      }
      label={t("insights.metrics.visits")}
      value={typeof value === "number" ? formatNumber(value) : "—"}
    />
  );
}

function Metric({ action, label, value }: { action?: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          {action}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium leading-6">{value}</p>
    </div>
  );
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function selectRecentSeries<T extends { date: string }>(series: T[], days: number) {
  if (!series.length) return [];
  const latest = new Date(`${series.at(-1)?.date}T23:59:59.999Z`).getTime();
  const from = latest - (days - 1) * 24 * 60 * 60 * 1000;
  return series.filter((point) => new Date(`${point.date}T00:00:00.000Z`).getTime() >= from);
}

function formatMoney(value: number | null | undefined, currency: string, locale: string) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatNumber(value: number | null | undefined, locale: string) {
  return typeof value === "number" ? new Intl.NumberFormat(locale).format(value) : "—";
}

function shortDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
    new Date(value),
  );
}

function longDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function longDateOnly(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}
