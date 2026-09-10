"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import { ArrowDownRightIcon, ArrowUpRightIcon, Maximize2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { HelpTip } from "@/components/app/help-tip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  aggregateSalesSeries,
  selectPreviousSeries,
  selectRecentSeries,
} from "@/features/insights/insights-periods";
import { InsightsReportNav } from "@/features/insights/insights-report-nav";
import type { InsightsReport } from "@/features/insights/insights-report-workspace";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  demoMode?: boolean;
  report: "overview" | InsightsReport;
  summary: MerchantDashboardSummary;
};
type Period = "30" | "90" | "all";
type SalesMetric = "revenue" | "orders";

const funnelKeys = {
  storefront_visits: "insights.funnel.storefrontVisits",
  product_views: "insights.funnel.productViews",
  add_to_cart: "insights.funnel.addToCart",
  checkout_started: "insights.funnel.checkoutStarted",
  orders_created: "insights.funnel.ordersCreated",
} as const;

export function InsightsWorkspace({ demoMode = false, report, summary }: Props) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>("30");
  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-14 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <InsightsReportNav demoMode={demoMode} />
          {report === "overview" || report === "sales" ? (
            <SegmentedControl
              active="muted"
              ariaLabel={t("insights.period.label")}
              className="mb-2 w-full sm:mb-0 sm:w-auto"
              fullWidth
              onChange={setPeriod}
              options={[
                { id: "30", label: t("insights.period.thirtyDays") },
                { id: "90", label: t("insights.period.ninetyDays") },
                { id: "all", label: t("insights.period.allTime") },
              ]}
              size="sm"
              value={period}
            />
          ) : (
            <p className="pb-2 text-xs text-muted-foreground sm:pb-0">
              {t("insights.period.thirtyDays")}
            </p>
          )}
        </div>
      </div>
      {report === "overview" ? <Overview period={period} summary={summary} /> : null}
      {report === "sales" ? <Sales period={period} summary={summary} /> : null}
      {report === "journey" ? <Journey summary={summary} /> : null}
      {report === "traffic" ? <Traffic summary={summary} /> : null}
    </div>
  );
}

function Overview({ period, summary }: { period: Period; summary: MerchantDashboardSummary }) {
  const { locale, t } = useI18n();
  const sales = useSalesRange(summary, period);
  const traffic = availableProvider(summary)?.traffic;
  const visits = summary.analytics?.storefront?.visits ?? traffic?.visits ?? null;
  const orders = summary.analytics?.funnel.find((stage) => stage.key === "orders_created")?.count;
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="grid divide-y lg:grid-cols-[minmax(0,1fr)_18rem] lg:divide-x lg:divide-y-0">
          <div>
            <CardHeader className="border-b">
              <div>
                <CardTitle>{t("insights.overview.performance")}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {period === "all" ? t("insights.period.allTime") : t("insights.sales.compared")}
                </p>
              </div>
            </CardHeader>
            <SalesMetricStrip
              sales={sales}
              period={period}
              secondary={[
                {
                  change: delta(sales.averageOrder, sales.previousAverageOrder, period),
                  label: t("insights.metrics.averageOrder"),
                  value: money(sales.averageOrder, sales.currency, locale),
                },
                {
                  label: t("insights.metrics.purchaseRate"),
                  value: percent(orders, visits, locale),
                },
              ]}
            />
            <OverviewTrend sales={sales} />
          </div>
          <JourneySummary stages={summary.analytics?.funnel ?? []} />
        </div>
      </Card>
      <OverviewSignals summary={summary} />
    </div>
  );
}

function Sales({ period, summary }: { period: Period; summary: MerchantDashboardSummary }) {
  const { formatNumber, locale, t } = useI18n();
  const sales = useSalesRange(summary, period);
  const customers = summary.operations?.customers;
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <div>
            <CardTitle>{t("insights.sales.title")}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{t("insights.sales.description")}</p>
          </div>
        </CardHeader>
        <SalesMetricStrip
          sales={sales}
          period={period}
          secondary={[
            {
              change: delta(sales.averageOrder, sales.previousAverageOrder, period),
              label: t("insights.metrics.averageOrder"),
              value: money(sales.averageOrder, sales.currency, locale),
            },
          ]}
        />
        <SalesChart sales={sales} tall />
      </Card>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t("insights.customers.title")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            <ValueRow
              label={t("insights.reports.customersUnique")}
              value={formatNumber(customers?.unique ?? 0)}
            />
            <ValueRow
              label={t("insights.reports.customersReturning")}
              value={formatNumber(customers?.repeat ?? 0)}
            />
            <ValueRow
              label={t("insights.customers.repeatRate")}
              value={percent(customers?.repeat, customers?.unique, locale)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t("insights.sales.periodSummary")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            <ValueRow
              label={t("insights.metrics.orders")}
              value={formatNumber(sales.totals.orders)}
            />
            <ValueRow
              label={t("insights.metrics.averageOrder")}
              value={money(sales.averageOrder, sales.currency, locale)}
            />
            <ValueRow
              label={t("insights.sales.bestDay")}
              value={bestSalesDay(sales.chart, locale, t("insights.common.notAvailable"))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Journey({ summary }: { summary: MerchantDashboardSummary }) {
  const { t } = useI18n();
  const stages = summary.analytics?.funnel ?? [];
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-center gap-1.5">
            <CardTitle>{t("insights.funnel.title")}</CardTitle>
            <HelpTip
              summary={t("insights.funnel.disclaimer")}
              title={t("insights.funnel.helpTitle")}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("insights.funnel.description")}</p>
        </CardHeader>
        <CardContent className="p-0">
          {stages.length ? (
            <JourneyFlow stages={stages} />
          ) : (
            <Empty
              title={t("insights.funnel.emptyTitle")}
              description={t("insights.funnel.emptyDescription")}
            />
          )}
        </CardContent>
      </Card>
      <ProductTable products={summary.analytics?.products ?? []} journey />
    </div>
  );
}

function Traffic({ summary }: { summary: MerchantDashboardSummary }) {
  const { formatNumber, locale, t } = useI18n();
  const [metric, setMetric] = useState<"visits" | "pageViews">("visits");
  const provider = availableProvider(summary);
  if (!provider?.traffic)
    return (
      <Card>
        <Empty
          title={t("insights.unavailable.title")}
          description={t("insights.unavailable.description")}
        />
      </Card>
    );
  const config = {
    visits: { color: "var(--chart-1)", label: t("insights.storefront.visits") },
    pageViews: { color: "var(--muted-foreground)", label: t("insights.storefront.pageViews") },
  };
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="grid border-b md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid grid-cols-2">
            <SelectableMetric
              active={metric === "visits"}
              label={t("insights.storefront.visits")}
              onClick={() => setMetric("visits")}
              value={formatNumber(provider.traffic.visits)}
            />
            <SelectableMetric
              active={metric === "pageViews"}
              label={t("insights.storefront.pageViews")}
              onClick={() => setMetric("pageViews")}
              value={formatNumber(provider.traffic.pageViews)}
            />
          </div>
          <div className="grid grid-cols-3 border-t md:border-l md:border-t-0">
            <QuietMetric
              label={t("insights.storefront.visitors")}
              value={formatNumber(provider.traffic.visitors)}
            />
            <QuietMetric
              label={t("insights.storefront.bounceRate")}
              value={ratio(provider.traffic.bounceRate, locale)}
            />
            <QuietMetric
              label={t("insights.storefront.visitDuration")}
              value={duration(provider.traffic.visitDurationSeconds, locale)}
            />
          </div>
        </div>
        <div className="px-3 pb-4 pt-6 sm:px-5">
          <ChartContainer className="h-[320px] w-full" config={config}>
            <ComposedChart
              accessibilityLayer
              data={provider.series}
              margin={{ left: 4, right: 8, top: 8 }}
            >
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="1 9"
                strokeOpacity={0.55}
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="date"
                minTickGap={32}
                tickFormatter={(v) => shortDate(v, locale)}
                tickLine={false}
              />
              <YAxis axisLine={false} tickLine={false} width={42} />
              <ChartTooltip
                content={
                  <ChartTooltipContent labelFormatter={(v) => longDate(String(v), locale)} />
                }
              />
              <Area
                dataKey={metric}
                fill={`var(--color-${metric})`}
                fillOpacity={0.1}
                stroke={`var(--color-${metric})`}
                strokeWidth={2.5}
                type="linear"
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      </Card>
      <div className="grid auto-rows-fr gap-5 lg:grid-cols-2">
        <Dimension
          title={t("insights.acquisition.title")}
          empty={t("insights.acquisition.empty")}
          rows={provider.dimensions.referrer}
        />
        <Dimension
          title={t("insights.pages.title")}
          empty={t("insights.pages.empty")}
          rows={provider.dimensions.path}
        />
        <Dimension
          title={t("insights.devices.title")}
          empty={t("insights.devices.empty")}
          rows={provider.dimensions.device}
        />
        <Dimension
          title={t("insights.traffic.actions")}
          empty={t("insights.traffic.actionsEmpty")}
          rows={storefrontActions(summary, [
            t("insights.traffic.productViewed"),
            t("insights.traffic.cartAdded"),
            t("insights.traffic.checkoutStarted"),
            t("insights.traffic.searched"),
            t("insights.traffic.contacted"),
          ])}
        />
      </div>
    </div>
  );
}

function useSalesRange(summary: MerchantDashboardSummary, period: Period) {
  const [metric, setMetric] = useState<SalesMetric>("revenue");
  const days = period === "all" ? null : Number(period);
  const full = summary.operations?.series ?? [];
  const current = useMemo(
    () => (days === null ? full : selectRecentSeries(full, days)),
    [days, full],
  );
  const previous = useMemo(
    () => (days === null ? [] : selectPreviousSeries(full, days)),
    [days, full],
  );
  const bucket = period === "all" ? "month" : period === "90" ? "week" : "day";
  const series = useMemo(() => aggregateSalesSeries(current, bucket), [bucket, current]);
  const previousSeries = useMemo(() => aggregateSalesSeries(previous, bucket), [bucket, previous]);
  const chart = series.map((point, index) => ({
    ...point,
    previousOrders: previousSeries[index]?.orders,
    previousRevenue: previousSeries[index]?.revenue,
  }));
  const totals = sumSales(current);
  const previousTotals = sumSales(previous);
  return {
    averageOrder: totals.orders ? totals.revenue / totals.orders : null,
    chart,
    currency: summary.operations?.totals.currencyCode?.toUpperCase() ?? "ETB",
    days,
    metric,
    previousAverageOrder: previousTotals.orders
      ? previousTotals.revenue / previousTotals.orders
      : null,
    previousTotals,
    setMetric,
    totals,
  };
}

type SalesRange = ReturnType<typeof useSalesRange>;
function OverviewTrend({ sales }: { sales: SalesRange }) {
  const { t } = useI18n();
  const config = {
    orders: { color: "var(--chart-4)", label: t("insights.sales.orders") },
    revenue: { color: "var(--chart-1)", label: t("insights.sales.revenue") },
  };
  if (!sales.chart.length)
    return (
      <Empty
        title={t("insights.sales.emptyTitle")}
        description={t("insights.sales.emptyDescription")}
      />
    );
  return (
    <div className="relative px-4 pb-4 pt-5 sm:px-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-5 bottom-5 h-px bg-border/70"
      />
      <ChartContainer className="h-[180px] w-full" config={config}>
        <ComposedChart
          accessibilityLayer
          data={sales.chart}
          margin={{ bottom: 1, left: 1, right: 1, top: 8 }}
        >
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Area
            dataKey={sales.metric}
            fill={`var(--color-${sales.metric})`}
            fillOpacity={0.09}
            stroke={`var(--color-${sales.metric})`}
            strokeWidth={2.5}
            type={sales.metric === "orders" ? "stepAfter" : "linear"}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
function SalesChart({ sales, tall = false }: { sales: SalesRange; tall?: boolean }) {
  const { formatNumber, locale, t } = useI18n();
  const config = {
    orders: { color: "var(--chart-4)", label: t("insights.sales.orders") },
    previousOrders: { color: "var(--muted-foreground)", label: t("insights.sales.previous") },
    previousRevenue: { color: "var(--muted-foreground)", label: t("insights.sales.previous") },
    revenue: { color: "var(--chart-1)", label: t("insights.sales.revenue") },
  };
  if (!sales.chart.length)
    return (
      <Empty
        title={t("insights.sales.emptyTitle")}
        description={t("insights.sales.emptyDescription")}
      />
    );
  return (
    <div className="px-3 pb-4 pt-6 sm:px-5">
      <ChartContainer className={cn("w-full", tall ? "h-[390px]" : "h-[310px]")} config={config}>
        <ComposedChart accessibilityLayer data={sales.chart} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="1 9"
            strokeOpacity={0.55}
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="date"
            minTickGap={30}
            tickFormatter={(v) => shortDate(v, locale)}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(v) =>
              sales.metric === "revenue"
                ? compactMoney(Number(v), sales.currency, locale)
                : formatNumber(Number(v))
            }
            tickLine={false}
            width={64}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) =>
                  String(name).toLowerCase().includes("revenue")
                    ? money(Number(value), sales.currency, locale)
                    : formatNumber(Number(value))
                }
                labelFormatter={(v) => longDate(String(v), locale)}
              />
            }
          />
          {sales.days !== null ? (
            <Line
              dataKey={sales.metric === "revenue" ? "previousRevenue" : "previousOrders"}
              dot={false}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 7"
              strokeOpacity={0.45}
              strokeWidth={1.5}
              type="monotone"
            />
          ) : null}
          <Area
            dataKey={sales.metric}
            fill={`var(--color-${sales.metric})`}
            fillOpacity={0.08}
            stroke={`var(--color-${sales.metric})`}
            strokeWidth={2.5}
            type={sales.metric === "orders" ? "stepAfter" : "linear"}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

function SalesMetricStrip({
  sales,
  period,
  secondary,
}: {
  sales: SalesRange;
  period: Period;
  secondary: Array<{ change?: number | null; label: string; value: string }>;
}) {
  const { formatNumber, locale, t } = useI18n();
  return (
    <div className="grid border-b sm:grid-cols-2 xl:grid-cols-4">
      <SelectableMetric
        active={sales.metric === "revenue"}
        change={delta(sales.totals.revenue, sales.previousTotals.revenue, period)}
        label={t("insights.metrics.revenue")}
        onClick={() => sales.setMetric("revenue")}
        value={money(sales.totals.revenue, sales.currency, locale)}
      />
      <SelectableMetric
        active={sales.metric === "orders"}
        change={delta(sales.totals.orders, sales.previousTotals.orders, period)}
        label={t("insights.metrics.orders")}
        onClick={() => sales.setMetric("orders")}
        value={formatNumber(sales.totals.orders)}
      />
      {secondary.map((item) => (
        <Metric key={item.label} {...item} />
      ))}
    </div>
  );
}
function Metric({
  change: valueChange,
  label,
  value,
}: {
  change?: number | null;
  label: string;
  value: string;
}) {
  const { locale, t } = useI18n();
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {valueChange == null ? null : (
          <span
            className={cn(
              "inline-flex items-center text-xs font-medium",
              valueChange >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive",
            )}
          >
            {valueChange >= 0 ? (
              <ArrowUpRightIcon className="size-3" />
            ) : (
              <ArrowDownRightIcon className="size-3" />
            )}
            {new Intl.NumberFormat(locale, { maximumFractionDigits: 0, style: "percent" }).format(
              Math.abs(valueChange),
            )}
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {valueChange == null ? null : (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t("insights.sales.previousPeriod")}
        </p>
      )}
    </div>
  );
}

function SelectableMetric({
  active,
  change,
  label,
  onClick,
  value,
}: {
  active: boolean;
  change?: number | null;
  label: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "relative min-h-24 border-r px-4 py-4 text-left transition-colors last:border-r-0 hover:bg-muted/45 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        active &&
          "bg-muted/55 after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        {change == null ? null : (
          <span
            className={cn(
              "font-medium",
              change >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive",
            )}
          >
            {change > 0 ? "+" : ""}
            {new Intl.NumberFormat(undefined, {
              maximumFractionDigits: 0,
              style: "percent",
            }).format(change)}
          </span>
        )}
      </span>
      <span className="mt-1 block text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
    </button>
  );
}

function QuietMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-r px-3 py-4 last:border-r-0">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function JourneySummary({
  stages,
}: {
  stages: NonNullable<MerchantDashboardSummary["analytics"]>["funnel"];
}) {
  const { formatNumber, locale, t } = useI18n();
  const first = stages[0]?.count ?? 0;
  return (
    <aside className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{t("insights.funnel.title")}</h3>
        <span className="text-xs text-muted-foreground">{t("insights.period.thirtyDays")}</span>
      </div>
      {stages.length ? (
        <ol className="mt-5 space-y-4">
          {stages.map((stage, index) => (
            <li key={stage.key}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t(funnelKeys[stage.key])}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {index === 0
                      ? t("insights.funnel.sessionsUnit")
                      : percent(stage.count, first, locale)}
                  </p>
                </div>
                <p className="text-lg font-semibold tabular-nums">{formatNumber(stage.count)}</p>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${first ? Math.max(3, (stage.count / first) * 100) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          {t("insights.funnel.emptyDescription")}
        </p>
      )}
    </aside>
  );
}
function JourneyFlow({
  stages,
}: {
  stages: NonNullable<MerchantDashboardSummary["analytics"]>["funnel"];
}) {
  const { formatNumber, locale, t } = useI18n();
  const first = stages[0]?.count ?? 0;
  return (
    <ol className="divide-y lg:grid lg:grid-cols-5 lg:divide-x lg:divide-y-0">
      {stages.map((stage, index) => {
        const previous = stages[index - 1]?.count;
        return (
          <li className="relative p-5" key={stage.key}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </p>
            <p className="mt-6 min-h-10 text-sm font-medium">{t(funnelKeys[stage.key])}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {formatNumber(stage.count)}
            </p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${first ? Math.max(3, (stage.count / first) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {index === 0
                ? t("insights.funnel.sessionsUnit")
                : t("insights.funnel.fromPrevious", {
                    rate: percent(stage.count, previous, locale),
                  })}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function ProductTable({
  products,
  journey = false,
}: {
  products: NonNullable<NonNullable<MerchantDashboardSummary["analytics"]>["products"]>;
  journey?: boolean;
}) {
  const { formatNumber, locale, t } = useI18n();
  const shown = products;
  const max = Math.max(...shown.map((product) => product.viewVisits), 1);
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          {journey ? t("insights.products.journeyTitle") : t("insights.reports.productInterest")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("insights.reports.product")}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("insights.reports.viewVisits")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("insights.reports.addToCartVisits")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("insights.reports.productConversion")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((product) => (
                  <tr key={product.productId}>
                    <td className="max-w-72 px-4 py-3 font-medium">
                      <span className="block truncate">{humanize(product.productId)}</span>
                      <span className="mt-2 block h-1 max-w-48 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${(product.viewVisits / max) * 100}%` }}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumber(product.viewVisits)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumber(product.addToCartVisits)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {percent(product.addToCartVisits, product.viewVisits, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={t("insights.reports.noProductActivity")}
            description={t("insights.reports.productInterestDescription")}
          />
        )}
      </CardContent>
    </Card>
  );
}
function OverviewSignals({ summary }: { summary: MerchantDashboardSummary }) {
  const { formatNumber, t } = useI18n();
  const provider = availableProvider(summary);
  const product = summary.analytics?.products?.[0];
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t("insights.overview.signals")}</CardTitle>
      </CardHeader>
      <CardContent className="grid divide-y p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Signal
          label={t("insights.overview.topProduct")}
          primary={product ? humanize(product.productId) : t("insights.common.notAvailable")}
          secondary={
            product
              ? t("insights.overview.productViews", { count: formatNumber(product.viewVisits) })
              : ""
          }
        />
        <Signal
          label={t("insights.overview.topSource")}
          primary={provider?.dimensions.referrer[0]?.key || t("insights.common.notAvailable")}
          secondary={
            provider?.dimensions.referrer[0]
              ? t("insights.overview.visits", {
                  count: formatNumber(provider.dimensions.referrer[0].visits),
                })
              : ""
          }
        />
        <Signal
          label={t("insights.overview.popularPage")}
          primary={provider?.dimensions.path[0]?.key || t("insights.common.notAvailable")}
          secondary={
            provider?.dimensions.path[0]
              ? t("insights.overview.visits", {
                  count: formatNumber(provider.dimensions.path[0].visits),
                })
              : ""
          }
        />
      </CardContent>
    </Card>
  );
}

function Signal({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold">{primary}</p>
      {secondary ? <p className="mt-1 text-xs text-muted-foreground">{secondary}</p> : null}
    </div>
  );
}
function Dimension({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ key: string; visits: number }>;
}) {
  const { t } = useI18n();
  const max = Math.max(...rows.map((row) => row.visits), 1);
  const content = <DimensionRows empty={empty} max={max} rows={rows} />;
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b">
        <CardTitle>{title}</CardTitle>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              aria-label={t("insights.traffic.viewDetails", { title })}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Maximize2Icon />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[min(86dvh,44rem)] overflow-hidden p-0 sm:max-w-2xl">
            <DialogHeader className="border-b px-5 py-4">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{t("insights.traffic.detailDescription")}</DialogDescription>
            </DialogHeader>
            <div className="max-h-[min(70dvh,36rem)] overflow-y-auto">{content}</div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <DimensionRows empty={empty} max={max} rows={rows.slice(0, 6)} />
      </CardContent>
    </Card>
  );
}

function DimensionRows({
  empty,
  max,
  rows,
}: {
  empty: string;
  max: number;
  rows: Array<{ key: string; visits: number }>;
}) {
  const { formatNumber } = useI18n();
  if (!rows.length)
    return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="divide-y">
      {rows.map((row) => (
        <li
          className="relative flex items-center justify-between gap-3 overflow-hidden px-4 py-3"
          key={row.key || "direct"}
        >
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-0 rounded-r bg-primary/7"
            style={{ width: `${(row.visits / max) * 100}%` }}
          />
          <span className="relative min-w-0 truncate text-sm font-medium">
            {row.key || "Direct"}
          </span>
          <span className="relative text-sm tabular-nums text-muted-foreground">
            {formatNumber(row.visits)}
          </span>
        </li>
      ))}
    </ol>
  );
}
function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[55%] truncate text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}
function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
function availableProvider(summary: MerchantDashboardSummary) {
  const provider = summary.analytics?.provider;
  return provider?.status === "available" ? provider : undefined;
}
function storefrontActions(summary: MerchantDashboardSummary, labels: string[]) {
  const storefront = summary.analytics?.storefront;
  if (!storefront) return [];
  return [
    { key: labels[0] ?? "", visits: storefront.productViewVisits },
    { key: labels[1] ?? "", visits: storefront.addToCartVisits },
    { key: labels[2] ?? "", visits: storefront.checkoutVisits },
    { key: labels[3] ?? "", visits: storefront.searchVisits },
    { key: labels[4] ?? "", visits: storefront.contactVisits },
  ].sort((left, right) => right.visits - left.visits);
}
function sumSales(series: Array<{ orders: number; revenue: number }>) {
  return series.reduce(
    (sum, point) => ({ orders: sum.orders + point.orders, revenue: sum.revenue + point.revenue }),
    { orders: 0, revenue: 0 },
  );
}
function bestSalesDay(
  series: Array<{ date: string; revenue: number }>,
  locale: string,
  fallback: string,
) {
  const best = series.reduce<(typeof series)[number] | undefined>(
    (current, point) => (!current || point.revenue > current.revenue ? point : current),
    undefined,
  );
  return best?.revenue ? longDate(best.date, locale) : fallback;
}
function delta(
  current: number | null | undefined,
  previous: number | null | undefined,
  period: Period,
) {
  return period === "all" || current == null || !previous ? null : (current - previous) / previous;
}
function money(value: number | null | undefined, currency: string, locale: string) {
  return value == null
    ? "N/A"
    : new Intl.NumberFormat(locale, {
        currency,
        maximumFractionDigits: 0,
        style: "currency",
      }).format(value);
}
function compactMoney(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(value);
}
function percent(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  locale: string,
) {
  return numerator == null || !denominator
    ? "N/A"
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 0, style: "percent" }).format(
        numerator / denominator,
      );
}
function ratio(value: number | null | undefined, locale: string) {
  return value == null
    ? "N/A"
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 0, style: "percent" }).format(value);
}
function duration(value: number | null | undefined, locale: string) {
  if (value == null) return "N/A";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return minutes
    ? `${new Intl.NumberFormat(locale).format(minutes)}m ${new Intl.NumberFormat(locale).format(seconds)}s`
    : `${new Intl.NumberFormat(locale).format(seconds)}s`;
}
function shortDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
    new Date(value),
  );
}
function longDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}
function humanize(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
