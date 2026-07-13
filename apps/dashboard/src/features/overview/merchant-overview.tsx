"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
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
import { Separator } from "@/components/ui/separator";
import type { ChartMetric, MerchantOverviewProps } from "@/features/overview/overview-config";
import {
  averageOrderConfig,
  chartConfig,
  commerceItems,
  demandRhythmConfig,
  tradingChartConfig,
} from "@/features/overview/overview-config";
import {
  compactMoney,
  DetailRow,
  formatMoney,
  formatNumber,
  formatReadableDate,
  formatShortDate,
  getDemandRhythmRows,
  humanizeEvent,
  LaunchAssistant,
  MetricCard,
  ReadinessBlock,
  StatusDonutChart,
  sampleNote,
  TopEventsChart,
} from "@/features/overview/overview-helpers";
import { formatOrderReference } from "@/features/orders/order-domain";
import {
  getLaunchAssistantOpenPreference,
  isLaunchAssistantHidden,
  LAUNCH_ASSISTANT_PREFERENCE_EVENT,
  setLaunchAssistantHidden,
  setLaunchAssistantOpenPreference,
} from "@/lib/launch-assistant-preferences";
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

export function MerchantOverview({ summary }: MerchantOverviewProps) {
  const [metric, setMetric] = useState<ChartMetric>("revenue");
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
  const topEvents = summary.analytics?.topEvents ?? [];
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
      },
      {
        label: "Awaiting payment",
        value: operations?.attention.unpaidOrders,
        href: dashboardRoutes.orders,
      },
      {
        label: "Draft products",
        value: operations?.attention.draftProducts,
        href: dashboardRoutes.products,
      },
    ],
    [operations],
  );

  return (
    <section className="flex flex-col gap-4" aria-label="Merchant overview">
      <div className="grid gap-4 xl:grid-cols-6">
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.9fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <div>
              <CardTitle>Trading Activity</CardTitle>
              <CardDescription>
                Revenue, order volume, and customer activity from available commerce records.
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
          <CardContent className="overflow-hidden pt-4">
            {hasSeries ? (
              <ChartContainer className="min-h-80 w-full px-3" config={tradingChartConfig}>
                <ComposedChart
                  data={tradingRows}
                  margin={{ bottom: 10, left: 14, right: 42, top: 8 }}
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
                              {tradingChartConfig[name as keyof typeof tradingChartConfig]?.label ??
                                name}
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
                      metric === "customers" ? "var(--color-customers)" : "var(--color-orderTrend)"
                    }
                    strokeWidth={2.25}
                    dot={false}
                    hide={metric === "revenue"}
                  />
                  <Brush
                    dataKey="date"
                    height={24}
                    stroke="var(--muted-foreground)"
                    travellerWidth={10}
                    tickFormatter={formatShortDate}
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Commerce activity will appear here after orders are available for this shop.
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{String(metricLabel)} view</span>
              <span>{operations?.range.label ?? "No sales data yet"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader className="border-b">
            <CardTitle>Needs Attention</CardTitle>
            <CardDescription>Operational queues that usually need the next action.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-4">
            {attentionItems.map((item) => (
              <Link
                className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                href={item.href}
                key={item.label}
              >
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatNumber(item.value)}
                </span>
              </Link>
            ))}
            <Separator />
            <ReadinessBlock summary={summary} />
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Basket Quality</CardTitle>
            <CardDescription>Average order value against daily order volume.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden">
            {averageOrderRows.length > 0 ? (
              <ChartContainer className="min-h-72 w-full px-2" config={averageOrderConfig}>
                <ComposedChart
                  data={averageOrderRows}
                  margin={{ bottom: 8, left: 12, right: 34, top: 8 }}
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
                    width={54}
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
              <p className="text-sm text-muted-foreground">No basket data is available.</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Demand Rhythm</CardTitle>
            <CardDescription>Which weekdays carry the most order activity.</CardDescription>
          </CardHeader>
          <CardContent>
            {demandRhythmRows.length > 0 ? (
              <ChartContainer className="min-h-72 w-full" config={demandRhythmConfig}>
                <RadarChart
                  data={demandRhythmRows}
                  margin={{ bottom: 12, left: 18, right: 18, top: 12 }}
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
              <p className="text-sm text-muted-foreground">No weekday demand data is available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-4">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Payment Mix</CardTitle>
            <CardDescription>Payment state across the recent order sample.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDonutChart rows={operations?.breakdowns.paymentStatus ?? []} title="Payments" />
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Fulfillment Mix</CardTitle>
            <CardDescription>Where orders sit before completion.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDonutChart
              rows={operations?.breakdowns.fulfillmentStatus ?? []}
              title="Fulfillment"
            />
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Order Lifecycle</CardTitle>
            <CardDescription>Current lifecycle state for recent orders.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDonutChart rows={operations?.breakdowns.orderStatus ?? []} title="Orders" />
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Customer Mix</CardTitle>
            <CardDescription>Repeat behavior across recent customers.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDonutChart rows={customerRows} title="Customers" subject="customers" />
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Storefront Signals</CardTitle>
            <CardDescription>
              {summary.analytics?.unavailable
                ? "Storefront activity will appear after customers visit your shop."
                : "Top tracked events from the last 30 days."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {topEvents.length > 0 ? (
              <TopEventsChart rows={topEvents} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No storefront events have been recorded in the selected range.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Billing Snapshot</CardTitle>
            <CardDescription>
              {summary.billing?.unavailable
                ? "Billing setup is not complete yet."
                : "Current subscription and recent invoice state."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <DetailRow label="Plan" value={summary.billing?.plan?.name ?? "Unavailable"} />
            <DetailRow
              label="Subscription"
              value={summary.billing?.subscription?.status ?? "Unavailable"}
            />
            <DetailRow
              label="Invoices"
              value={`${summary.billing?.invoices.length ?? 0} recent records`}
            />
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest orders for this shop.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(operations?.recentOrders.length ?? 0) > 0 ? (
              operations?.recentOrders.map((order) => (
                <Link
                  className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-muted/50"
                  href={dashboardRoutes.orderDetail(order.id)}
                  key={order.id}
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
                  <span className="font-mono text-xs tabular-nums">
                    {formatMoney(order.total, order.currencyCode ?? currencyCode)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent orders are available.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <LaunchAssistant summary={summary} />
    </section>
  );
}
