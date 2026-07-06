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
import {
  getLaunchAssistantOpenPreference,
  isLaunchAssistantHidden,
  LAUNCH_ASSISTANT_PREFERENCE_EVENT,
  setLaunchAssistantHidden,
  setLaunchAssistantOpenPreference,
} from "@/lib/launch-assistant-preferences";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type MerchantOverviewProps = {
  summary: MerchantDashboardSummary;
};

type ChartMetric = "revenue" | "orders" | "customers";

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
  orders: {
    label: "Orders",
    color: "var(--chart-2)",
  },
  customers: {
    label: "Customers",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const tradingChartConfig = {
  revenue: chartConfig.revenue,
  orderBars: {
    label: "Orders",
    color: "var(--chart-2)",
  },
  orderTrend: {
    label: "Order trend",
    color: "var(--chart-5)",
  },
  customers: chartConfig.customers,
} satisfies ChartConfig;

const averageOrderConfig = {
  averageOrderValue: {
    label: "AOV",
    color: "var(--chart-1)",
  },
  orders: {
    label: "Orders",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const demandRhythmConfig = {
  orders: {
    label: "Orders",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const statusRingColors = [
  "var(--primary)",
  "oklch(0.72 0.17 195)",
  "oklch(0.7 0.18 292)",
  "oklch(0.74 0.18 28)",
  "oklch(0.73 0.16 145)",
] as const;

const commerceItems = [
  { key: "hasStore", label: "Sales setup" },
  { key: "hasSalesChannel", label: "Sales channel" },
] as const;

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
                      {order.displayId ? `#${order.displayId}` : order.id}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {order.email ?? "No email"}
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

function MetricCard({
  className,
  href,
  label,
  note,
  value,
}: {
  className?: string;
  href: string;
  label: string;
  note: string;
  value: string;
}) {
  return (
    <Card className={cn("transition-colors hover:bg-muted/30", className)}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <Link className="text-xs text-muted-foreground hover:text-foreground" href={href}>
          {note}
        </Link>
      </CardContent>
    </Card>
  );
}

function StatusDonutChart({
  rows,
  subject = "orders",
  title,
}: {
  rows: Array<{ count: number; label: string }>;
  subject?: string;
  title: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const chartRows = rows.slice(0, 5).map((row, index) => ({
    ...row,
    fill: statusRingColors[index % statusRingColors.length] ?? statusRingColors[0],
  }));
  const config = Object.fromEntries(
    chartRows.map((row) => [
      row.label,
      {
        label: row.label,
        color: row.fill,
      },
    ]),
  ) satisfies ChartConfig;

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No order data is available.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-[150px_1fr]">
      <ChartContainer className="aspect-square min-h-36" config={config}>
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie data={chartRows} dataKey="count" nameKey="label" innerRadius={42} outerRadius={64}>
            {chartRows.map((row) => (
              <Cell fill={row.fill} key={row.label} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex flex-col justify-center gap-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString()} {subject}
          </p>
        </div>
        {chartRows.map((row) => (
          <div className="flex items-center justify-between gap-3 text-sm" key={row.label}>
            <span className="truncate capitalize text-muted-foreground">
              {row.label.replaceAll("_", " ")}
            </span>
            <span className="font-mono tabular-nums">{row.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopEventsChart({ rows }: { rows: Array<{ count: number; eventType: string }> }) {
  const data = rows.slice(0, 5).map((row) => ({
    eventType: humanizeEvent(row.eventType),
    count: row.count,
  }));
  const config = {
    count: {
      label: "Events",
      color: "var(--chart-4)",
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer className="min-h-56 w-full" config={config}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="eventType"
          tickLine={false}
          axisLine={false}
          width={118}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} barSize={16} />
      </BarChart>
    </ChartContainer>
  );
}
function ReadinessBlock({ summary }: { summary: MerchantDashboardSummary }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{summary.tenant.name}</p>
          <p className="text-xs text-muted-foreground">
            /{summary.tenant.handle} · {summary.domain.hostname}
          </p>
        </div>
        <Badge className="capitalize" variant="secondary">
          {summary.tenant.status}
        </Badge>
      </div>
      <div className="grid gap-2">
        {commerceItems.map((item) => (
          <ReadinessRow key={item.key} label={item.label} ready={summary.commerce[item.key]} />
        ))}
        <ReadinessRow label="Published storefront" ready={summary.storefront.isPublished} />
      </div>
    </div>
  );
}

function LaunchAssistant({ summary }: { summary: MerchantDashboardSummary }) {
  const items = getLaunchChecklistItems(summary);
  const completedCount = items.filter((item) => item.ready).length;
  const complete = completedCount === items.length;
  const [hydrated, setHydrated] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nextHidden = isLaunchAssistantHidden(summary.tenant.id);
    const nextOpen = getLaunchAssistantOpenPreference(summary.tenant.id);

    setHidden(nextHidden);
    setOpen(nextHidden ? false : (nextOpen ?? !complete));
    setHydrated(true);

    function handlePreferenceChange(event: Event) {
      const detail = (event as CustomEvent<{ hidden?: boolean; tenantId?: string }>).detail;

      if (detail?.tenantId !== summary.tenant.id || typeof detail.hidden !== "boolean") {
        return;
      }

      setHidden(detail.hidden);
      setOpen(
        detail.hidden ? false : (getLaunchAssistantOpenPreference(summary.tenant.id) ?? !complete),
      );
    }

    window.addEventListener(LAUNCH_ASSISTANT_PREFERENCE_EVENT, handlePreferenceChange);

    return () => {
      window.removeEventListener(LAUNCH_ASSISTANT_PREFERENCE_EVENT, handlePreferenceChange);
    };
  }, [complete, summary.tenant.id]);

  function dismissAssistant() {
    setLaunchAssistantHidden(summary.tenant.id, true);
    toast("Launch assistant hidden", {
      description: "Turn it back on from Settings > Account.",
    });
  }

  function openAssistant() {
    setOpen((value) => {
      const nextOpen = !value;

      setLaunchAssistantOpenPreference(summary.tenant.id, nextOpen);

      return nextOpen;
    });
  }

  if (!hydrated || hidden) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      <div
        aria-hidden={!open}
        className={cn(
          "w-[min(420px,calc(100vw-2rem))] origin-bottom-right overflow-hidden rounded-xl border bg-background shadow-lg transition-all duration-200 ease-out",
          hydrated && open
            ? "max-h-[720px] translate-y-0 scale-100 opacity-100"
            : "pointer-events-none max-h-0 translate-y-2 scale-95 opacity-0",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <p className="text-sm font-semibold">Launch Assistant</p>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {items.length} setup items complete
            </p>
          </div>
          <Button
            aria-label="Close launch assistant"
            className="text-xl leading-none"
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => {
              setLaunchAssistantOpenPreference(summary.tenant.id, false);
              setOpen(false);
            }}
          >
            ×
          </Button>
        </div>
        <div className="flex flex-col gap-2 p-3">
          {items.map((item) => (
            <Link
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              href={item.href}
              key={item.label}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold",
                  item.ready
                    ? "border-primary bg-primary text-primary-foreground"
                    : item.current
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground",
                )}
              >
                {item.ready ? "✓" : item.current ? "•" : ""}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <Badge variant={item.ready ? "secondary" : item.current ? "default" : "outline"}>
                {item.ready ? "Done" : item.current ? "Next" : "Open"}
              </Badge>
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t p-3">
          <Button asChild size="sm" variant="outline">
            <Link href={`${dashboardRoutes.settings}?tab=storefront`}>Storefront settings</Link>
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={dismissAssistant}>
            Do not show again
          </Button>
        </div>
      </div>

      <Button
        aria-expanded={open}
        className="shadow-lg transition-transform duration-150 hover:-translate-y-0.5"
        type="button"
        onClick={openAssistant}
      >
        Launch {completedCount}/{items.length}
      </Button>
    </div>
  );
}

function getLaunchChecklistItems(summary: MerchantDashboardSummary) {
  const hasShopProfile = Boolean(
    summary.tenant.name.trim() && summary.tenant.handle.trim() && summary.domain.hostname.trim(),
  );
  const hasSalesBackend = summary.commerce.hasStore && summary.commerce.hasSalesChannel;
  const hasCatalog = (summary.operations?.totals.products ?? 0) > 0;
  const hasStorefrontDraft = Boolean(
    summary.storefront.templateKey ?? summary.storefront.templateId,
  );
  const hasPublishedStorefront = summary.storefront.isPublished;
  const hasPayments = !summary.billing?.unavailable && Boolean(summary.billing?.plan);
  const states = [
    hasShopProfile,
    hasSalesBackend,
    hasCatalog,
    hasStorefrontDraft,
    hasPublishedStorefront,
    hasPayments,
  ];
  const nextIndex = states.findIndex((state) => !state);

  return [
    {
      label: "Shop profile",
      description: hasShopProfile ? summary.domain.hostname : "Add shop name and address",
      ready: hasShopProfile,
      href: dashboardRoutes.settings,
    },
    {
      label: "Sales setup",
      description: "Store and channel",
      ready: hasSalesBackend,
      href: dashboardRoutes.settings,
    },
    {
      label: "Catalog",
      description: `${formatNumber(summary.operations?.totals.products)} products`,
      ready: hasCatalog,
      href: dashboardRoutes.products,
    },
    {
      label: "Storefront design",
      description: hasStorefrontDraft ? "Storefront selected" : "Choose a storefront",
      ready: hasStorefrontDraft,
      href: `${dashboardRoutes.settings}?tab=storefront`,
    },
    {
      label: "Publish storefront",
      description: hasPublishedStorefront ? "Customers can access the shop" : "Review and publish",
      ready: hasPublishedStorefront,
      href: dashboardRoutes.editor,
    },
    {
      label: "Payments",
      description: hasPayments ? "Billing connected" : "Payment setup pending",
      ready: hasPayments,
      href: dashboardRoutes.billing,
    },
  ].map((item, index) => ({ ...item, current: index === nextIndex }));
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge
        className={cn(!ready && "text-muted-foreground")}
        variant={ready ? "default" : "outline"}
      >
        {ready ? "Ready" : "Missing"}
      </Badge>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium capitalize">{value}</span>
    </div>
  );
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "Unavailable";
}

function formatMoney(value: number | null | undefined, currencyCode: string) {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en", {
    currency: currencyCode || "ETB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function compactMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode || "ETB",
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
  }).format(value);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatReadableDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function humanizeEvent(value: string) {
  return value.replaceAll(".", " ").replaceAll("_", " ");
}

function getDemandRhythmRows(series: Array<{ date: string; orders: number }>) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const totals = new Map(days.map((day) => [day, 0]));

  for (const row of series) {
    const day = days[new Date(row.date).getDay()];

    if (day) {
      totals.set(day, (totals.get(day) ?? 0) + row.orders);
    }
  }

  return days
    .map((day) => ({
      day,
      orders: totals.get(day) ?? 0,
    }))
    .filter((row) => row.orders > 0);
}

function sampleNote(value: number | undefined) {
  if (typeof value !== "number") {
    return "No sales data yet";
  }

  return `${value.toLocaleString()} records reviewed`;
}
