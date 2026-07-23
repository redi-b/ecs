"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "@/components/app/link";
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChartMetric, MerchantOverviewProps } from "@/features/overview/overview-config";
import { chartColorConfig } from "@/features/overview/overview-config";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { LaunchAssistant } from "@/features/overview/launch-assistant";
import {
  ChartEmptyState,
  compactMoney,
  formatMoney,
  formatNumber,
  formatReadableDate,
  formatShortDate,
  getDemandRhythmRows,
  MetricCard,
  ReadinessBlock,
  StatusDonutChart,
  sampleNote,
} from "@/features/overview/overview-helpers";
import { formatOrderReference } from "@/features/orders/order-domain";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

function formatOverviewPaymentStatus(
  paymentStatus: string,
  t: (key: MessageKey) => string,
) {
  const value = paymentStatus.trim().toLowerCase();
  if (value.includes("captured") || value === "paid" || value.includes("refund")) {
    return t("overview.paymentStatus.paid");
  }
  if (value.includes("fail") || value === "canceled" || value === "cancelled") {
    return t("overview.paymentStatus.failed");
  }
  return t("overview.paymentStatus.unpaid");
}

function isOpenPaymentStatus(status: string | null | undefined) {
  if (!status) return false;
  const value = status.trim().toLowerCase();
  return value !== "captured" && value !== "paid" && !value.includes("refund");
}

function isOpenFulfillmentStatus(status: string | null | undefined) {
  if (!status) return true;
  const value = status.trim().toLowerCase();
  return value !== "fulfilled" && value !== "delivered" && value !== "shipped";
}

type MixView = "payment" | "fulfillment" | "lifecycle" | "customers";

type BillingNotice = {
  tone: "warning" | "reminder";
  title: string;
  description: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BILLING_REMINDER_WINDOW_DAYS = 7;

/** Only surface billing when action is needed. Free forever plans stay quiet. */
function getBillingNotice(
  summary: MerchantDashboardSummary,
  t: (key: MessageKey, values?: Record<string, string | number | Date>) => string,
  locale: string,
): BillingNotice | null {
  const billing = summary.billing;
  if (!billing || billing.unavailable || !billing.plan || !billing.subscription) {
    return null;
  }

  const isFree =
    billing.plan.isFree === true || Number(billing.plan.price) === 0;

  const now = Date.now();
  const status = billing.subscription.status.toLowerCase();
  const periodEnd = billing.subscription.currentPeriodEnd
    ? new Date(billing.subscription.currentPeriodEnd).getTime()
    : null;
  const daysToPeriodEnd =
    typeof periodEnd === "number" && Number.isFinite(periodEnd)
      ? (periodEnd - now) / MS_PER_DAY
      : null;

  const openInvoice = billing.invoices.find((invoice) => {
    if (invoice.provider === "trial") return false;
    if (Number(invoice.amount) === 0) return false;
    const invoiceStatus = invoice.status.toLowerCase();
    return invoiceStatus === "pending" || invoiceStatus === "unpaid" || invoiceStatus === "open";
  });
  const invoiceDueMs = openInvoice?.dueAt ? new Date(openInvoice.dueAt).getTime() : null;
  const daysToInvoiceDue =
    typeof invoiceDueMs === "number" && Number.isFinite(invoiceDueMs)
      ? (invoiceDueMs - now) / MS_PER_DAY
      : null;

  // Open upgrade/renewal invoice always matters (including free shops mid-upgrade).
  if (openInvoice && typeof daysToInvoiceDue === "number" && daysToInvoiceDue < 0) {
    return {
      tone: "warning",
      title: t("overview.billing.paymentOverdue"),
      description: t("overview.billing.paymentOverdueDesc", {
        date: formatReadableDate(openInvoice.dueAt!, locale),
      }),
    };
  }

  if (openInvoice) {
    return {
      tone: "reminder",
      title: t("overview.billing.paymentDue"),
      description: openInvoice.dueAt
        ? t("overview.billing.paymentDueDesc", {
            date: formatReadableDate(openInvoice.dueAt, locale),
          })
        : t("overview.billing.paymentDueNoDate"),
    };
  }

  if (isFree) {
    return null;
  }

  if (status === "past_due") {
    return {
      tone: "warning",
      title: t("overview.billing.paymentPastDue"),
      description: t("overview.billing.paymentPastDueDesc"),
    };
  }

  if (status === "canceled" || status === "cancelled") {
    return {
      tone: "warning",
      title: t("overview.billing.subscriptionCancelled"),
      description: t("overview.billing.subscriptionCancelledDesc"),
    };
  }

  if (
    status === "active" &&
    typeof daysToPeriodEnd === "number" &&
    daysToPeriodEnd >= 0 &&
    daysToPeriodEnd <= BILLING_REMINDER_WINDOW_DAYS
  ) {
    return {
      tone: "reminder",
      title: t("overview.billing.periodEnding"),
      description: t("overview.billing.periodEndingDesc", {
        date: formatReadableDate(billing.subscription.currentPeriodEnd!, locale),
      }),
    };
  }

  return null;
}

export function MerchantOverview({ summary }: MerchantOverviewProps) {
  const { t, locale } = useI18n();
  const [metric, setMetric] = useState<ChartMetric>("revenue");
  const [mixView, setMixView] = useState<MixView>("payment");

  const tradingChartConfig = useMemo(
    () => ({
      revenue: { label: t("overview.metrics.revenue"), ...chartColorConfig.revenue },
      orderBars: { label: t("overview.metrics.orders"), ...chartColorConfig.orderBars },
      orderTrend: { label: t("overview.metrics.orderTrend"), ...chartColorConfig.orderTrend },
      customers: { label: t("overview.metrics.customers"), ...chartColorConfig.customers },
    }),
    [t],
  );
  const averageOrderConfig = useMemo(
    () => ({
      averageOrderValue: { label: t("overview.metrics.aov"), ...chartColorConfig.averageOrderValue },
      orders: { label: t("overview.metrics.orders"), ...chartColorConfig.orders },
    }),
    [t],
  );
  const demandRhythmConfig = useMemo(
    () => ({
      orders: { label: t("overview.metrics.orders"), ...chartColorConfig.orders },
    }),
    [t],
  );
  const operations = summary.operations;
  const series = operations?.series ?? [];
  const hasSeries = series.length > 0;
  const tradingRows = series.map((row) => ({
    ...row,
    orderBars: row.orders,
    orderTrend: row.orders,
  }));
  const currencyCode = operations?.totals.currencyCode?.toUpperCase() ?? "ETB";
  const metricLabel =
    metric === "revenue"
      ? t("overview.metrics.revenue")
      : metric === "orders"
        ? t("overview.metrics.orders")
        : t("overview.metrics.customers");
  const averageOrderRows = series
    .filter((row) => row.orders > 0)
    .map((row) => ({
      date: row.date,
      orders: row.orders,
      averageOrderValue: Math.round(row.revenue / row.orders),
    }));
  const demandRhythmRows = getDemandRhythmRows(series);
  const customerRows =
    typeof operations?.customers.unique === "number" &&
    typeof operations.customers.repeat === "number"
      ? [
          {
            label: t("overview.mix.newCustomers"),
            count: Math.max(operations.customers.unique - operations.customers.repeat, 0),
          },
          {
            label: t("overview.mix.repeatCustomers"),
            count: operations.customers.repeat,
          },
        ].filter((row) => row.count > 0)
      : [];

  const attentionItems = useMemo(
    () => [
      {
        label: t("overview.attention.unfulfilledOrders"),
        value: operations?.attention.unfulfilledOrders,
        href: dashboardRoutes.orders,
        hint: t("overview.attention.unfulfilledHint"),
      },
      {
        label: t("overview.attention.awaitingPayment"),
        value: operations?.attention.unpaidOrders,
        href: dashboardRoutes.orders,
        hint: t("overview.attention.awaitingPaymentHint"),
      },
      {
        label: t("overview.attention.draftProducts"),
        value: operations?.attention.draftProducts,
        href: dashboardRoutes.products,
        hint: t("overview.attention.draftProductsHint"),
      },
    ],
    [operations, t],
  );

  const waitingOrders = useMemo(() => {
    const rows = operations?.recentOrders ?? [];
    return rows
      .map((order) => {
        const needsPayment = isOpenPaymentStatus(order.paymentStatus);
        const needsFulfillment = isOpenFulfillmentStatus(order.fulfillmentStatus);
        if (!needsPayment && !needsFulfillment) {
          return null;
        }
        return {
          ...order,
          reasons: [
            needsPayment ? t("overview.attention.unpaid") : null,
            needsFulfillment ? t("overview.attention.unfulfilled") : null,
          ].filter((reason): reason is string => Boolean(reason)),
        };
      })
      .filter((order): order is NonNullable<typeof order> => order != null)
      .slice(0, 2);
  }, [operations?.recentOrders, t]);

  const mixViews: Array<{
    id: MixView;
    label: string;
    description: string;
    title: string;
    subject?: string;
    rows: Array<{ count: number; label: string }>;
  }> = [
    {
      id: "payment",
      label: t("overview.mix.payment"),
      description: t("overview.mix.paymentDesc"),
      title: t("overview.mix.paymentsTitle"),
      rows: operations?.breakdowns.paymentStatus ?? [],
    },
    {
      id: "fulfillment",
      label: t("overview.mix.fulfillment"),
      description: t("overview.mix.fulfillmentDesc"),
      title: t("overview.mix.fulfillment"),
      rows: operations?.breakdowns.fulfillmentStatus ?? [],
    },
    {
      id: "lifecycle",
      label: t("overview.mix.lifecycle"),
      description: t("overview.mix.lifecycleDesc"),
      title: t("overview.metrics.orders"),
      rows: operations?.breakdowns.orderStatus ?? [],
    },
    {
      id: "customers",
      label: t("overview.mix.customers"),
      description: t("overview.mix.customersDesc"),
      title: t("overview.mix.customers"),
      subject: "customers",
      rows: customerRows,
    },
  ];
  const activeMix = mixViews.find((view) => view.id === mixView) ?? mixViews[0]!;
  const billingNotice = getBillingNotice(summary, t, locale);

  return (
    <section className="flex flex-col gap-4" aria-label={t("overview.aria.section")}>
      {billingNotice ? (
        <Alert
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            billingNotice.tone === "warning" && "border-destructive/40",
          )}
        >
          <div className="min-w-0">
            <AlertTitle>{billingNotice.title}</AlertTitle>
            <AlertDescription>{billingNotice.description}</AlertDescription>
          </div>
          <Button asChild className="shrink-0 self-start sm:self-center" size="sm" variant="outline">
            <Link href={dashboardRoutes.billing} prefetch={false}>
              {t("overview.billing.openBilling")}
            </Link>
          </Button>
        </Alert>
      ) : null}

      {/* Operator first: queues + readiness, then quieter KPIs */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)] xl:items-stretch">
        <Card className="flex h-full flex-col" size="sm">
          <CardHeader className="shrink-0 border-b pb-3">
            <CardTitle>{t("overview.attention.title")}</CardTitle>
            <CardDescription>{t("overview.attention.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 pt-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {attentionItems.map((item) => {
                const count = typeof item.value === "number" ? item.value : null;
                const hot = typeof count === "number" && count > 0;

                return (
                  <Link
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50",
                      hot ? "border-primary/25 bg-primary/5" : "bg-background",
                    )}
                    href={item.href}
                    key={item.label}
                    prefetch={false}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 font-medium leading-snug">{item.label}</span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-lg font-semibold tabular-nums leading-none",
                          hot ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {formatNumber(item.value, locale)}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{item.hint}</span>
                  </Link>
                );
              })}
            </div>

            {waitingOrders.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="type-eyebrow">{t("overview.attention.waitingOnYou")}</p>
                  <Link
                    className="text-xs text-muted-foreground hover:text-foreground"
                    href={dashboardRoutes.orders}
                    prefetch={false}
                  >
                    {t("overview.attention.allOrders")}
                  </Link>
                </div>
                <div className="flex flex-col gap-1">
                  {waitingOrders.map((order) => (
                    <Link
                      className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                      href={dashboardRoutes.orderDetail(order.id)}
                      key={order.id}
                      prefetch={false}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {formatOrderReference({ id: order.id })}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1">
                          {order.reasons.map((reason) => (
                            <Badge
                              className="px-1.5 py-0 text-[10px] font-normal"
                              key={reason}
                              variant="secondary"
                            >
                              {reason}
                            </Badge>
                          ))}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums">
                        {formatMoney(order.total, order.currencyCode ?? currencyCode, locale)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col" size="sm">
          <CardHeader className="shrink-0 border-b pb-3">
            <CardTitle>{t("overview.readiness.shopTitle")}</CardTitle>
            <CardDescription>{t("overview.readiness.shopDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center pt-3">
            <ReadinessBlock summary={summary} />
          </CardContent>
        </Card>
      </div>

      {/* Commerce KPIs only — storefront analytics stay out of the ops strip */}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          href={dashboardRoutes.orders}
          label={t("overview.metrics.revenue")}
          note={operations?.range.label ?? t("overview.metrics.noSalesYet")}
          value={formatMoney(operations?.totals.revenue, currencyCode, locale)}
        />
        <MetricCard
          href={dashboardRoutes.orders}
          label={t("overview.metrics.orders")}
          note={sampleNote(operations?.range.sampledOrderCount, t, locale)}
          value={formatNumber(operations?.totals.orders, locale)}
        />
        <MetricCard
          href={dashboardRoutes.products}
          label={t("overview.metrics.products")}
          note={t("overview.metrics.catalogCount")}
          value={formatNumber(operations?.totals.products, locale)}
        />
        <MetricCard
          href={dashboardRoutes.customers}
          label={t("overview.metrics.customers")}
          note={t("overview.metrics.repeatCount", {
            count: formatNumber(operations?.customers.repeat, locale),
          })}
          value={formatNumber(operations?.customers.unique, locale)}
        />
      </div>

      <Card className="flex min-h-0 flex-col overflow-hidden">
        <CardHeader className="shrink-0 border-b">
          <div>
            <CardTitle>{t("overview.trading.title")}</CardTitle>
            <CardDescription>{t("overview.trading.description")}</CardDescription>
          </div>
          {hasSeries ? (
            <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
              <Select value={metric} onValueChange={(value) => setMetric(value as ChartMetric)}>
                <SelectTrigger size="sm" aria-label={t("overview.aria.chartMetric")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="revenue">{t("overview.metrics.revenue")}</SelectItem>
                    <SelectItem value="orders">{t("overview.metrics.orders")}</SelectItem>
                    <SelectItem value="customers">{t("overview.metrics.customers")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col pt-4">
          {hasSeries ? (
            <div className="relative min-h-72 w-full flex-1">
              <div className="absolute inset-0 px-2">
                <ChartContainer
                  className="aspect-auto! h-full w-full justify-stretch"
                  config={tradingChartConfig}
                  initialDimension={{ width: 720, height: 320 }}
                >
                  <ComposedChart
                    data={tradingRows}
                    // left margin + YAxis width must fit compact "ETB 60K" ticks
                    margin={{ bottom: 8, left: 4, right: 20, top: 8 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={28}
                      tickFormatter={(v) => formatShortDate(String(v), locale)}
                    />
                    <YAxis
                      yAxisId="value"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={6}
                      width={58}
                      tickFormatter={(value) =>
                        metric === "revenue"
                          ? compactMoney(Number(value), currencyCode, locale)
                          : String(value)
                      }
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => formatReadableDate(String(value), locale)}
                          formatter={(value, name) => (
                            <>
                              <span className="text-muted-foreground">
                                {tradingChartConfig[name as keyof typeof tradingChartConfig]
                                  ?.label ?? name}
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {name === "revenue"
                                  ? formatMoney(Number(value), currencyCode, locale)
                                  : Number(value).toLocaleString()}
                              </span>
                            </>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                      yAxisId="value"
                      type="monotone"
                      dataKey="revenue"
                      fill="var(--color-revenue)"
                      fillOpacity={metric === "revenue" ? 0.22 : 0.08}
                      stroke="var(--color-revenue)"
                      strokeWidth={metric === "revenue" ? 2.5 : 1.5}
                      hide={metric !== "revenue"}
                    />
                    <Bar
                      yAxisId="value"
                      dataKey="orderBars"
                      fill="var(--color-orderBars)"
                      radius={[4, 4, 0, 0]}
                      barSize={18}
                      hide={metric === "revenue"}
                    />
                    <Line
                      yAxisId="value"
                      type="monotone"
                      dataKey={metric === "customers" ? "customers" : "orderTrend"}
                      stroke={
                        metric === "customers"
                          ? "var(--color-customers)"
                          : "var(--color-orderTrend)"
                      }
                      strokeWidth={2.25}
                      dot={false}
                      hide={metric === "revenue"}
                    />
                    <Brush
                      dataKey="date"
                      height={22}
                      stroke="var(--muted-foreground)"
                      travellerWidth={10}
                      tickFormatter={(v) => formatShortDate(String(v), locale)}
                    />
                  </ComposedChart>
                </ChartContainer>
              </div>
            </div>
          ) : (
            <ChartEmptyState
              className="min-h-72"
              ctaHref={`${dashboardRoutes.orders}?create=order`}
              ctaLabel={t("overview.trading.emptyCta")}
              description={t("overview.trading.empty")}
              title={t("overview.trading.emptyTitle")}
            />
          )}
          {hasSeries ? (
            <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{t("overview.metrics.metricView", { label: String(metricLabel) })}</span>
              <span>{operations?.range.label ?? t("overview.metrics.noSalesYet")}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Equal-height chart pair — card surfaces fill the row */}
      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
        <Card className="flex min-h-[22rem] flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>{t("overview.basket.title")}</CardTitle>
            <CardDescription>{t("overview.basket.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col overflow-hidden">
            {averageOrderRows.length > 0 ? (
              <ChartContainer className="min-h-64 w-full flex-1 px-1" config={averageOrderConfig}>
                <ComposedChart
                  data={averageOrderRows}
                  margin={{ bottom: 8, left: 4, right: 20, top: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={28}
                    tickFormatter={(v) => formatShortDate(String(v), locale)}
                  />
                  <YAxis
                    yAxisId="money"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    width={58}
                    tickFormatter={(value) => compactMoney(Number(value), currencyCode, locale)}
                  />
                  <YAxis yAxisId="orders" orientation="right" hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => formatReadableDate(String(value), locale)}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    yAxisId="orders"
                    dataKey="orders"
                    fill="var(--color-orders)"
                    fillOpacity={0.18}
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                  />
                  <Line
                    yAxisId="money"
                    type="monotone"
                    dataKey="averageOrderValue"
                    stroke="var(--color-averageOrderValue)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <ChartEmptyState
                description={t("overview.basket.empty")}
                title={t("overview.basket.emptyTitle")}
              />
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[22rem] flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>{t("overview.demand.title")}</CardTitle>
            <CardDescription>{t("overview.demand.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {demandRhythmRows.length > 0 ? (
              <ChartContainer className="min-h-64 w-full flex-1" config={demandRhythmConfig}>
                <RadarChart
                  data={demandRhythmRows}
                  margin={{ bottom: 8, left: 12, right: 12, top: 8 }}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="day" tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Radar
                    dataKey="orders"
                    fill="var(--color-orders)"
                    fillOpacity={0.18}
                    stroke="var(--color-orders)"
                    strokeWidth={2.5}
                  />
                </RadarChart>
              </ChartContainer>
            ) : (
              <ChartEmptyState
                description={t("overview.demand.empty")}
                title={t("overview.demand.emptyTitle")}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stretch pair so the shorter card grows (card fill, not page void) */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex flex-col">
          <CardHeader className="border-b pb-3">
            <div>
              <CardTitle>{t("overview.mix.title")}</CardTitle>
              <CardDescription>{activeMix.description}</CardDescription>
            </div>
            {activeMix.rows.length > 0 ||
            mixViews.some((view) => view.rows.length > 0) ? (
              <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                <Select value={mixView} onValueChange={(value) => setMixView(value as MixView)}>
                  <SelectTrigger
                    size="sm"
                    aria-label={t("overview.aria.mixView")}
                    className="min-w-[8.5rem]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {mixViews.map((view) => (
                        <SelectItem key={view.id} value={view.id}>
                          {view.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center pt-4">
            <StatusDonutChart
              rows={activeMix.rows}
              title={activeMix.title}
              {...(activeMix.subject ? { subject: activeMix.subject } : {})}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="border-b pb-3">
            <CardTitle>{t("overview.recent.title")}</CardTitle>
            <CardDescription>{t("overview.recent.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-1 pt-3">
            {(operations?.recentOrders.length ?? 0) > 0 ? (
              <div className="flex flex-1 flex-col gap-0.5">
                {operations?.recentOrders.map((order) => (
                  <Link
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/50"
                    href={dashboardRoutes.orderDetail(order.id)}
                    key={order.id}
                    prefetch={false}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {formatOrderReference({ id: order.id })}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {order.email ?? t("overview.recent.noEmail")}
                        {order.paymentStatus
                          ? ` · ${formatOverviewPaymentStatus(order.paymentStatus, t)}`
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">
                      {formatMoney(order.total, order.currencyCode ?? currencyCode, locale)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <ChartEmptyState
                className="min-h-40 border-0 bg-transparent py-6"
                ctaHref={`${dashboardRoutes.orders}?create=order`}
                ctaLabel={t("overview.trading.emptyCta")}
                description={t("overview.recent.empty")}
                title={t("overview.recent.emptyTitle")}
              />
            )}
            {(operations?.recentOrders.length ?? 0) > 0 ? (
              <Button asChild className="mt-auto w-full" size="sm" variant="outline">
                <Link href={dashboardRoutes.orders} prefetch={false}>
                  {t("overview.recent.viewAll")}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <LaunchAssistant summary={summary} />
    </section>
  );
}
