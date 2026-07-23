"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "@/components/app/link";
import { Cell, Pie, PieChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { commerceItemKeys, statusRingColors } from "@/features/overview/overview-config";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { cn } from "@/lib/utils";

/** Dense ops KPI tile: whole surface is the link, no nested card chrome. */
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
    <Link
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-xl bg-card px-3.5 py-3 ring-1 ring-foreground/[0.08]",
        "shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]",
        "transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      href={href}
      prefetch={false}
    >
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
        {value}
      </span>
      <span className="truncate text-xs text-muted-foreground">{note}</span>
    </Link>
  );
}

export function ChartEmptyState({
  className,
  ctaHref,
  ctaLabel,
  description,
  title,
}: {
  className?: string;
  ctaHref?: string;
  ctaLabel?: string;
  description: string;
  title: string;
}) {
  return (
    <Empty
      className={cn(
        "min-h-56 flex-1 justify-center border-dashed bg-muted/15 px-6 py-10",
        className,
      )}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <svg
            aria-hidden
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            viewBox="0 0 24 24"
          >
            <path d="M3 3v18h18" />
            <path d="M7 14l4-4 3 3 5-6" />
          </svg>
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {ctaHref && ctaLabel ? (
        <EmptyContent>
          <Button asChild size="sm" variant="outline">
            <Link href={ctaHref} prefetch={false}>
              {ctaLabel}
            </Link>
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export function StatusDonutChart({
  rows,
  subject = "orders",
  title,
  className,
}: {
  rows: Array<{ count: number; label: string }>;
  subject?: string;
  title: string;
  className?: string;
}) {
  const { t } = useI18n();
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const chartRows = rows.slice(0, 5).map((row, index) => ({
    ...row,
    fill: statusRingColors[index % statusRingColors.length] ?? statusRingColors[0],
    share: total > 0 ? Math.round((row.count / total) * 100) : 0,
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
    return (
      <ChartEmptyState
        className={cn("min-h-40 py-8", className)}
        description={t("overview.donut.empty")}
        title={t("overview.donut.emptyTitle")}
      />
    );
  }

  return (
    <div className={cn("grid gap-4 sm:grid-cols-[7.5rem_1fr] sm:items-center", className)}>
      <ChartContainer className="mx-auto aspect-square h-36 w-36 sm:h-auto sm:w-full" config={config}>
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie data={chartRows} dataKey="count" nameKey="label" innerRadius={38} outerRadius={58}>
            {chartRows.map((row) => (
              <Cell fill={row.fill} key={row.label} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex flex-col justify-center gap-2.5">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString()} {subject}
          </p>
        </div>
        {chartRows.map((row) => (
          <div className="flex flex-col gap-1" key={row.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 truncate capitalize text-muted-foreground">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: row.fill }}
                />
                {row.label.replaceAll("_", " ")}
              </span>
              <span className="shrink-0 font-mono tabular-nums">
                {row.count.toLocaleString()}
                <span className="ml-1.5 text-xs text-muted-foreground">{row.share}%</span>
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ background: row.fill, width: `${row.share}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ReadinessBlock({ summary }: { summary: MerchantDashboardSummary }) {
  const { t } = useI18n();
  const commerceLabels: Record<(typeof commerceItemKeys)[number], MessageKey> = {
    hasStore: "overview.readiness.salesSetup",
    hasSalesChannel: "overview.readiness.salesChannel",
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{summary.tenant.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            /{summary.tenant.handle} · {summary.domain.hostname}
          </p>
        </div>
        <Badge className="shrink-0 capitalize" variant="secondary">
          {summary.tenant.status}
        </Badge>
      </div>
      <div className="grid gap-1.5">
        {commerceItemKeys.map((key) => (
          <ReadinessRow key={key} label={t(commerceLabels[key])} ready={summary.commerce[key]} />
        ))}
        <ReadinessRow
          label={t("overview.readiness.publishedStorefront")}
          ready={summary.storefront.isPublished}
        />
      </div>
    </div>
  );
}

export function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge
        className={cn(!ready && "text-muted-foreground")}
        variant={ready ? "default" : "outline"}
      >
        {ready ? t("overview.readiness.ready") : t("overview.readiness.missing")}
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

export function formatNumber(value: number | null | undefined, locale = "en") {
  return typeof value === "number" ? value.toLocaleString(locale) : "—";
}

export function formatMoney(
  value: number | null | undefined,
  currencyCode: string,
  locale = "en",
) {
  if (typeof value !== "number") {
    return "—";
  }

  return new Intl.NumberFormat(locale, {
    currency: currencyCode || "ETB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function compactMoney(value: number, currencyCode: string, locale = "en") {
  return new Intl.NumberFormat(locale, {
    currency: currencyCode || "ETB",
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
  }).format(value);
}

export function formatShortDate(value: string, locale = "en") {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(value));
}

export function formatReadableDate(value: string, locale = "en") {
  return new Intl.DateTimeFormat(locale, {
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

export function sampleNote(
  value: number | undefined,
  t: (key: MessageKey, values?: Record<string, string | number | Date>) => string,
  locale = "en",
) {
  if (typeof value !== "number") {
    return t("overview.helpers.noSalesYet");
  }

  return t("overview.helpers.recordsReviewed", { count: value.toLocaleString(locale) });
}
