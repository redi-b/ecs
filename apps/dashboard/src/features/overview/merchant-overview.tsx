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
import {
  averageOrderConfig,
  chartConfig,
  demandRhythmConfig,
  tradingChartConfig,
} from "@/features/overview/overview-config";
import {
  compactMoney,
  formatMoney,
  formatNumber,
  formatReadableDate,
  formatShortDate,
  getDemandRhythmRows,
  LaunchAssistant,
  MetricCard,
  ReadinessBlock,
  StatusDonutChart,
  sampleNote,
} from "@/features/overview/overview-helpers";
import { formatOrderReference } from "@/features/orders/order-domain";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

function formatOverviewPaymentStatus(paymentStatus: string) {
  const value = paymentStatus.trim().toLowerCase();
  if (value.includes("captured") || value === "paid" || value.includes("refund")) {
    return "Paid";
  }
  if (value.includes("fail") || value === "canceled" || value === "cancelled") {
    return "Failed";
  }
  return "Unpaid";
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
function getBillingNotice(summary: MerchantDashboardSummary): BillingNotice | null {
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
      title: "Payment overdue",
      description: `A plan payment was due ${formatReadableDate(openInvoice.dueAt!)}. Open Billing to finish payment.`,
    };
  }

  if (openInvoice) {
    return {
      tone: "reminder",
      title: "Payment due",
      description: openInvoice.dueAt
        ? `A plan payment is due ${formatReadableDate(openInvoice.dueAt)}. Open Billing to pay.`
        : "You have an open plan payment. Open Billing to pay.",
    };
  }

  if (isFree) {
    return null;
  }

  if (status === "past_due") {
    return {
      tone: "warning",
      title: "Payment past due",
      description: "Your paid plan period has ended. Open Billing to pay and continue on this plan.",
    };
  }

  if (status === "canceled" || status === "cancelled") {
    return {
      tone: "warning",
      title: "Subscription cancelled",
      description: "This shop is not on an active paid plan. Open Billing to choose a plan.",
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
      title: "Plan period ending soon",
      description: `Your paid period ends ${formatReadableDate(billing.subscription.currentPeriodEnd!)}. Open Billing to renew.`,
    };
  }

  return null;
}

export function MerchantOverview({ summary }: MerchantOverviewProps) {
  const [metric, setMetric] = useState<ChartMetric>("revenue");
  const [mixView, setMixView] = useState<MixView>("payment");
  const operations = summary.operations;
  const series = operations?.series ?? [];
  const hasSeries = series.length > 0;
  const tradingRows = series.map((row) => ({
    ...row,
    orderBars: row.orders,
    orderTrend: row.orders,
  }));
  const currencyCode = operations?.totals.currencyCode?.toUpperCase() ?? "ETB";
  const metricLabel = chartConfig[metric].label;
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
            label: "New",
            count: Math.max(operations.customers.unique - operations.customers.repeat, 0),
          },
          {
            label: "Repeat",
            count: operations.customers.repeat,
          },
        ].filter((row) => row.count > 0)
      : [];

  const attentionItems = useMemo(
    () => [
      {
        label: "Unfulfilled orders",
        value: operations?.attention.unfulfilledOrders,
        href: dashboardRoutes.orders,
        hint: "Need packing or handoff",
      },
      {
        label: "Awaiting payment",
        value: operations?.attention.unpaidOrders,
        href: dashboardRoutes.orders,
        hint: "Still unpaid or pending",
      },
      {
        label: "Draft products",
        value: operations?.attention.draftProducts,
        href: dashboardRoutes.products,
        hint: "Not visible in the shop",
      },
    ],
    [operations],
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
            needsPayment ? "Unpaid" : null,
            needsFulfillment ? "Unfulfilled" : null,
          ].filter((reason): reason is string => Boolean(reason)),
        };
      })
      .filter((order): order is NonNullable<typeof order> => order != null)
      .slice(0, 2);
  }, [operations?.recentOrders]);

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
      label: "Payment",
      description: "Payment state across the recent order sample.",
      title: "Payments",
      rows: operations?.breakdowns.paymentStatus ?? [],
    },
    {
      id: "fulfillment",
      label: "Fulfillment",
      description: "Where orders sit before completion.",
      title: "Fulfillment",
      rows: operations?.breakdowns.fulfillmentStatus ?? [],
    },
    {
      id: "lifecycle",
      label: "Lifecycle",
      description: "Current lifecycle state for recent orders.",
      title: "Orders",
      rows: operations?.breakdowns.orderStatus ?? [],
    },
    {
      id: "customers",
      label: "Customers",
      description: "Repeat behavior across recent customers.",
      title: "Customers",
      subject: "customers",
      rows: customerRows,
    },
  ];
  const activeMix = mixViews.find((view) => view.id === mixView) ?? mixViews[0]!;
  const billingNotice = getBillingNotice(summary);

  return (
    <section className="flex flex-col gap-4" aria-label="Merchant overview">
      {/* Uneven KPI strip (kept intentionally) */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          className="xl:col-span-2"
          href={dashboardRoutes.orders}
          label="Revenue"
          note={operations?.range.label ?? "No sales data yet"}
          value={formatMoney(operations?.totals.revenue, currencyCode)}
        />
        <MetricCard
          className="xl:col-span-1"
          href={dashboardRoutes.orders}
          label="Orders"
          note={sampleNote(operations?.range.sampledOrderCount)}
          value={formatNumber(operations?.totals.orders)}
        />
        <MetricCard
          className="xl:col-span-1"
          href={dashboardRoutes.products}
          label="Products"
          note="Catalog count"
          value={formatNumber(operations?.totals.products)}
        />
        <MetricCard
          className="xl:col-span-1"
          href={dashboardRoutes.orders}
          label="Customers"
          note={`${formatNumber(operations?.customers.repeat)} repeat`}
          value={formatNumber(operations?.customers.unique)}
        />
        <MetricCard
          className="xl:col-span-1"
          href={dashboardRoutes.insights}
          label="Storefront events"
          note={summary.analytics?.unavailable ? "Analytics unavailable" : "Last 30 days"}
          value={formatNumber(summary.analytics?.totals.storefrontEvents)}
        />
      </div>

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
              Open billing
            </Link>
          </Button>
        </Alert>
      ) : null}

      {/* Match heights: compact attention sets the row; chart fills via absolute inset */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)] xl:items-stretch">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0 border-b">
            <div>
              <CardTitle>Trading activity</CardTitle>
              <CardDescription>
                Revenue, orders, and customers from available commerce records.
              </CardDescription>
            </div>
            <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
              <Select value={metric} onValueChange={(value) => setMetric(value as ChartMetric)}>
                <SelectTrigger size="sm" aria-label="Chart metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="orders">Orders</SelectItem>
                    <SelectItem value="customers">Customers</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
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
                      margin={{ bottom: 8, left: 8, right: 28, top: 8 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={28}
                        tickFormatter={formatShortDate}
                      />
                      <YAxis
                        yAxisId="value"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        width={44}
                        tickFormatter={(value) =>
                          metric === "revenue"
                            ? compactMoney(Number(value), currencyCode)
                            : String(value)
                        }
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(value) => formatReadableDate(String(value))}
                            formatter={(value, name) => (
                              <>
                                <span className="text-muted-foreground">
                                  {tradingChartConfig[
                                    name as keyof typeof tradingChartConfig
                                  ]?.label ?? name}
                                </span>
                                <span className="font-mono font-medium tabular-nums">
                                  {name === "revenue"
                                    ? formatMoney(Number(value), currencyCode)
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
                        tickFormatter={formatShortDate}
                      />
                    </ComposedChart>
                  </ChartContainer>
                </div>
              </div>
            ) : (
              <div className="flex min-h-72 flex-1 items-center justify-center rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Commerce activity will appear here after orders are available for this shop.
              </div>
            )}
            <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{String(metricLabel)} view</span>
              <span>{operations?.range.label ?? "No sales data yet"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader className="shrink-0 border-b pb-3">
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Queues and work waiting on you.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 pt-4">
            <div className="flex flex-col gap-2">
              {attentionItems.map((item) => {
                const count = typeof item.value === "number" ? item.value : null;
                const hot = typeof count === "number" && count > 0;

                return (
                  <Link
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50",
                      hot ? "border-primary/25 bg-primary/5" : "bg-background",
                    )}
                    href={item.href}
                    key={item.label}
                    prefetch={false}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.hint}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-lg font-semibold tabular-nums",
                        hot ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {formatNumber(item.value)}
                    </span>
                  </Link>
                );
              })}
            </div>

            {waitingOrders.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Waiting on you
                  </p>
                  <Link
                    className="text-xs text-muted-foreground hover:text-foreground"
                    href={dashboardRoutes.orders}
                    prefetch={false}
                  >
                    All orders
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
                        {formatMoney(order.total, order.currencyCode ?? currencyCode)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-auto">
              <ReadinessBlock summary={summary} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Equal-height chart pair — card surfaces fill the row */}
      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
        <Card className="flex min-h-[22rem] flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Basket quality</CardTitle>
            <CardDescription>Average order value against daily order volume.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col overflow-hidden">
            {averageOrderRows.length > 0 ? (
              <ChartContainer className="min-h-64 w-full flex-1 px-1" config={averageOrderConfig}>
                <ComposedChart
                  data={averageOrderRows}
                  margin={{ bottom: 8, left: 8, right: 24, top: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={28}
                    tickFormatter={formatShortDate}
                  />
                  <YAxis
                    yAxisId="money"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={48}
                    tickFormatter={(value) => compactMoney(Number(value), currencyCode)}
                  />
                  <YAxis yAxisId="orders" orientation="right" hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => formatReadableDate(String(value))}
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
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                No basket data is available.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[22rem] flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Demand rhythm</CardTitle>
            <CardDescription>Which weekdays carry the most order activity.</CardDescription>
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
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                No weekday demand data is available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stretch pair so the shorter card grows (card fill, not page void) */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex flex-col">
          <CardHeader className="border-b pb-3">
            <div>
              <CardTitle>Order mix</CardTitle>
              <CardDescription>{activeMix.description}</CardDescription>
            </div>
            <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
              <Select value={mixView} onValueChange={(value) => setMixView(value as MixView)}>
                <SelectTrigger size="sm" aria-label="Mix view" className="min-w-[8.5rem]">
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
            <CardTitle>Recent orders</CardTitle>
            <CardDescription>Latest orders for this shop.</CardDescription>
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
                        {order.email ?? "No email"}
                        {order.paymentStatus
                          ? ` · ${formatOverviewPaymentStatus(order.paymentStatus)}`
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">
                      {formatMoney(order.total, order.currencyCode ?? currencyCode)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
                No recent orders are available.
              </div>
            )}
            <Button asChild className="mt-auto w-full rounded-full" size="sm" variant="outline">
              <Link href={dashboardRoutes.orders} prefetch={false}>
                View all orders
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <LaunchAssistant summary={summary} />
    </section>
  );
}
