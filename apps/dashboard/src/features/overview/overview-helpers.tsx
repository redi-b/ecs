"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "@/components/app/link";
import { useEffect, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { commerceItemKeys, statusRingColors } from "@/features/overview/overview-config";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import {
  getLaunchAssistantOpenPreference,
  isLaunchAssistantHidden,
  LAUNCH_ASSISTANT_PREFERENCE_EVENT,
  setLaunchAssistantHidden,
  setLaunchAssistantOpenPreference,
} from "@/lib/launch-assistant-preferences";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

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
        <Link
          className="text-xs text-muted-foreground hover:text-foreground"
          href={href}
          prefetch={false}
        >
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
      <div className={cn("flex items-center justify-center py-8", className)}>
        <p className="text-sm text-muted-foreground">{t("overview.donut.empty")}</p>
      </div>
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
    <div className="flex flex-col gap-2.5 rounded-lg border bg-muted/25 p-3">
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

export function LaunchAssistant({ summary }: { summary: MerchantDashboardSummary }) {
  const { t } = useI18n();
  const items = getLaunchChecklistItems(summary, t);
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
    toast(t("overview.launch.hiddenToast"), {
      description: t("overview.launch.hiddenDesc"),
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
            <p className="text-sm font-semibold">{t("overview.launch.title")}</p>
            <p className="text-xs text-muted-foreground">
              {t("overview.launch.progress", { done: completedCount, total: items.length })}
            </p>
          </div>
          <Button
            aria-label={t("overview.aria.closeLaunch")}
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
              prefetch={false}
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
                {item.ready
                  ? t("overview.launch.done")
                  : item.current
                    ? t("overview.launch.next")
                    : t("overview.launch.open")}
              </Badge>
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t p-3">
          <Button asChild size="sm" variant="outline">
            <Link href={`${dashboardRoutes.settings}?tab=storefront`} prefetch={false}>
              {t("overview.launch.storefrontSettings")}
            </Link>
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={dismissAssistant}>
            {t("overview.launch.doNotShow")}
          </Button>
        </div>
      </div>

      <Button
        aria-expanded={open}
        className="shadow-lg transition-transform duration-150 hover:-translate-y-0.5"
        type="button"
        onClick={openAssistant}
      >
        {t("overview.launch.launchButton", { done: completedCount, total: items.length })}
      </Button>
    </div>
  );
}

export function getLaunchChecklistItems(
  summary: MerchantDashboardSummary,
  t: (key: MessageKey, values?: Record<string, string | number | Date>) => string,
) {
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
      label: t("overview.launch.shopProfile"),
      description: hasShopProfile
        ? summary.domain.hostname
        : t("overview.launch.shopProfileMissing"),
      ready: hasShopProfile,
      href: dashboardRoutes.settings,
    },
    {
      label: t("overview.launch.salesSetup"),
      description: t("overview.launch.salesSetupDesc"),
      ready: hasSalesBackend,
      href: dashboardRoutes.settings,
    },
    {
      label: t("overview.launch.catalog"),
      description: t("overview.launch.catalogDesc", {
        count: formatNumber(summary.operations?.totals.products),
      }),
      ready: hasCatalog,
      href: dashboardRoutes.products,
    },
    {
      label: t("overview.launch.storefrontDesign"),
      description: hasStorefrontDraft
        ? t("overview.launch.storefrontSelected")
        : t("overview.launch.chooseStorefront"),
      ready: hasStorefrontDraft,
      href: `${dashboardRoutes.settings}?tab=storefront`,
    },
    {
      label: t("overview.launch.publishStorefront"),
      description: hasPublishedStorefront
        ? t("overview.launch.customersCanAccess")
        : t("overview.launch.reviewAndPublish"),
      ready: hasPublishedStorefront,
      href: dashboardRoutes.editor,
    },
    {
      label: t("overview.launch.payments"),
      description: hasPayments
        ? t("overview.launch.billingConnected")
        : t("overview.launch.paymentPending"),
      ready: hasPayments,
      href: dashboardRoutes.billing,
    },
  ].map((item, index) => ({ ...item, current: index === nextIndex }));
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
