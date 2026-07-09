"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "next/link";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
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
import { useEffect, useMemo, useState } from "react";
import { commerceItems, statusRingColors } from "@/features/overview/overview-config";
import { toast } from "sonner";

export function MetricCard({
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

export function StatusDonutChart({
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

export function TopEventsChart({ rows }: { rows: Array<{ count: number; eventType: string }> }) {
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
export function ReadinessBlock({ summary }: { summary: MerchantDashboardSummary }) {
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

export function LaunchAssistant({ summary }: { summary: MerchantDashboardSummary }) {
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

export function getLaunchChecklistItems(summary: MerchantDashboardSummary) {
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

export function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
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

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium capitalize">{value}</span>
    </div>
  );
}

export function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "Unavailable";
}

export function formatMoney(value: number | null | undefined, currencyCode: string) {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en", {
    currency: currencyCode || "ETB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function compactMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en", {
    currency: currencyCode || "ETB",
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
  }).format(value);
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export function formatReadableDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function humanizeEvent(value: string) {
  return value.replaceAll(".", " ").replaceAll("_", " ");
}

export function getDemandRhythmRows(series: Array<{ date: string; orders: number }>) {
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

export function sampleNote(value: number | undefined) {
  if (typeof value !== "number") {
    return "No sales data yet";
  }

  return `${value.toLocaleString()} records reviewed`;
}

