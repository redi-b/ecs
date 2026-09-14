"use client";

import type { InsightsSalesReport } from "@ecs/contracts";
import { DownloadIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useId, useState, useTransition } from "react";
import { HelpTip } from "@/components/app/help-tip";
import { InlineDefinition } from "@/components/app/inline-definition";
import { ListTableSkeleton } from "@/components/app/list-table-skeleton";
import { PaginationBar } from "@/components/app/pagination-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { ReportDateRange } from "./report-date-range";
import { SalesComparisonChart } from "./sales-comparison-chart";
import {
  reportCsv,
  type SalesBucket,
  type SalesInterval,
  type SalesMeasure,
  salesBuckets,
  salesChange,
} from "./sales-report-model";

export function SalesReport({
  report,
  children,
}: {
  report: InsightsSalesReport;
  children?: ReactNode;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const compareId = useId();
  const [measure, setMeasure] = useState<SalesMeasure>("paidOrderValue");
  const [interval, setInterval] = useState<SalesInterval>(
    report.series.length > 60 ? "week" : "day",
  );
  const [view, setView] = useState<"chart" | "table">("chart");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const buckets = salesBuckets(report, measure, interval);
  const selectedIndex = Math.min(selected ?? buckets.length - 1, buckets.length - 1);
  const inspected = buckets[selectedIndex];
  const date = (day: string) =>
    new Intl.DateTimeFormat(`${locale}-u-ca-gregory`, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00:00Z`));
  const amount = (value: number | null) =>
    value === null
      ? t("insights.salesWorkspace.notAvailable")
      : new Intl.NumberFormat(
          locale,
          measure === "orders"
            ? { maximumFractionDigits: 0 }
            : { style: "currency", currency: "ETB", maximumFractionDigits: 2 },
        ).format(value);
  const range = (a: string, b: string) => (a === b ? date(a) : `${date(a)} – ${date(b)}`);
  const change = salesChange(
    report.totals?.[measure] ?? null,
    report.previousTotals?.[measure] ?? null,
  );

  function navigate(next: { from?: string; to?: string; comparison?: string }) {
    const search = new URLSearchParams(params.toString());
    search.set("from", next.from ?? report.range.from);
    search.set("to", next.to ?? report.range.to);
    search.set("comparison", next.comparison ?? (report.previousRange ? "previous" : "none"));
    search.delete("productPage");
    startTransition(() => router.replace(`${pathname}?${search}`, { scroll: false }));
  }

  function exportReport() {
    const url = URL.createObjectURL(
      new Blob([reportCsv(report)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-${report.range.from}-${report.range.to}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex flex-col gap-5" aria-busy={pending}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ReportDateRange report={report} pending={pending} onChange={navigate} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-h-9 items-center gap-3">
            <Switch
              id={compareId}
              checked={!!report.previousRange}
              disabled={pending}
              onCheckedChange={(checked) => navigate({ comparison: checked ? "previous" : "none" })}
            />
            <Label htmlFor={compareId}>{t("insights.salesWorkspace.compare")}</Label>
          </div>
          <Button variant="ghost" onClick={exportReport} disabled={pending}>
            <DownloadIcon data-icon="inline-start" />
            {t("insights.salesWorkspace.export")}
          </Button>
        </div>
      </div>
      {report.quality.status !== "fresh" || !report.totals ? (
        <Alert>
          <AlertDescription>
            {t(
              report.quality.status === "missing"
                ? "insights.salesWorkspace.preparing"
                : report.quality.status === "stale"
                  ? "insights.salesWorkspace.stale"
                  : "insights.salesWorkspace.partial",
            )}
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="flex w-full flex-col gap-5">
          <div className="flex w-full flex-wrap items-center gap-4">
            <div className="flex min-w-0 items-center gap-1.5">
              <SegmentedControl
                ariaLabel={t("insights.salesWorkspace.measure")}
                active="muted"
                fullWidth={false}
                value={measure}
                options={[
                  { id: "paidOrderValue", label: t("insights.salesWorkspace.paidOrderValue") },
                  { id: "orders", label: t("insights.salesWorkspace.orders") },
                ]}
                onChange={setMeasure}
              />
              <HelpTip
                summary={t(
                  measure === "paidOrderValue"
                    ? "insights.salesWorkspace.paidDefinition"
                    : "insights.salesWorkspace.orderDefinition",
                )}
              />
            </div>
            <div className="ml-auto flex flex-wrap justify-end gap-3">
              <SegmentedControl
                ariaLabel={t("insights.salesWorkspace.interval")}
                active="muted"
                fullWidth={false}
                size="sm"
                value={interval}
                options={[
                  { id: "day", label: t("insights.salesWorkspace.daily") },
                  { id: "week", label: t("insights.salesWorkspace.weekly") },
                ]}
                onChange={(value) => {
                  setInterval(value);
                  setSelected(null);
                  setPage(0);
                }}
              />
              <SegmentedControl
                ariaLabel={t("insights.salesWorkspace.view")}
                active="muted"
                fullWidth={false}
                size="sm"
                value={view}
                options={[
                  { id: "chart", label: t("insights.salesWorkspace.chart") },
                  { id: "table", label: t("insights.salesWorkspace.table") },
                ]}
                onChange={setView}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-2xl font-semibold tabular-nums tracking-tight">
              {amount(report.totals?.[measure] ?? null)}
            </h2>
            {change ? (
              <div className="inline-flex flex-wrap items-center gap-1.5 text-sm">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium tabular-nums",
                    change.amount > 0
                      ? "text-success"
                      : change.amount < 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {change.amount > 0 ? (
                    <TrendingUpIcon className="size-4" aria-hidden />
                  ) : change.amount < 0 ? (
                    <TrendingDownIcon className="size-4" aria-hidden />
                  ) : null}
                  {amount(Math.abs(change.amount))}{" "}
                  {t(
                    change.amount >= 0
                      ? "insights.salesWorkspace.higher"
                      : "insights.salesWorkspace.lower",
                  )}
                </span>
                <InlineDefinition
                  content={
                    <span className="flex flex-col gap-1">
                      <span>
                        {t("insights.contributions.thisPeriod")}:{" "}
                        {range(report.range.from, report.range.to)}
                      </span>
                      {report.previousRange ? (
                        <span>
                          {t("insights.contributions.previous")}:{" "}
                          {range(report.previousRange.from, report.previousRange.to)}
                        </span>
                      ) : null}
                    </span>
                  }
                >
                  {t("insights.salesWorkspace.previousPeriod")}
                </InlineDefinition>
              </div>
            ) : report.previousRange ? (
              <p className="text-sm text-muted-foreground">
                {t("insights.salesWorkspace.noComparison")}
              </p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {pending ? (
            view === "table" ? (
              <ListTableSkeleton embedded columns={4} rows={8} />
            ) : (
              <output
                className="flex h-80 flex-col justify-between gap-6"
                aria-label={t("common.loading")}
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="min-h-0 flex-1" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </output>
            )
          ) : view === "table" ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("insights.salesWorkspace.period")}</TableHead>
                    <TableHead className="text-right">
                      {t(`insights.salesWorkspace.${measure}`)}
                    </TableHead>
                    {report.previousRange ? (
                      <>
                        <TableHead>{t("insights.salesWorkspace.previousPeriod")}</TableHead>
                        <TableHead className="text-right">
                          {t("insights.salesWorkspace.previous")}
                        </TableHead>
                      </>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buckets.slice(page * 15, page * 15 + 15).map((bucket) => (
                    <TableRow key={bucket.from}>
                      <TableCell>{range(bucket.from, bucket.to)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {amount(bucket.current)}
                      </TableCell>
                      {report.previousRange ? (
                        <>
                          <TableCell>
                            {bucket.previousFrom && bucket.previousTo
                              ? range(bucket.previousFrom, bucket.previousTo)
                              : ""}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {amount(bucket.previous)}
                          </TableCell>
                        </>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={page + 1}
                totalPages={Math.ceil(buckets.length / 15)}
                onPageChange={(next) => setPage(next - 1)}
                summary={t("insights.salesWorkspace.rows", {
                  from: page * 15 + 1,
                  to: Math.min((page + 1) * 15, buckets.length),
                  total: buckets.length,
                })}
              />
            </>
          ) : buckets.every((bucket) => bucket.current === null && bucket.previous === null) ? (
            <Empty className="min-h-80">
              <EmptyHeader>
                <EmptyTitle>{t("insights.salesWorkspace.noHistory")}</EmptyTitle>
                <EmptyDescription>{t("insights.salesWorkspace.preparing")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <SalesComparisonChart
                buckets={buckets}
                selected={selectedIndex}
                onSelect={setSelected}
                amount={amount}
                axisAmount={(value) =>
                  new Intl.NumberFormat(locale, {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(value)
                }
                date={date}
                label={t("insights.salesWorkspace.inspect")}
              />
              {inspected ? (
                <Inspection
                  bucket={inspected}
                  range={range}
                  amount={amount}
                  comparing={!!report.previousRange}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
      {pending ? <ListTableSkeleton columns={4} rows={6} /> : children}
    </div>
  );
}

function Inspection({
  bucket,
  range,
  amount,
  comparing,
}: {
  bucket: SalesBucket;
  range: (a: string, b: string) => string;
  amount: (value: number | null) => string;
  comparing: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className="flex flex-wrap gap-x-10 gap-y-3 border-t pt-4"
      aria-live="polite"
      aria-atomic="true"
    >
      <div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-0.5 w-4 bg-primary" aria-hidden="true" />
          {t("insights.salesWorkspace.selected")} · {range(bucket.from, bucket.to)}
        </p>
        <p className="mt-1 text-lg font-medium tabular-nums">{amount(bucket.current)}</p>
      </div>
      {comparing && bucket.previousFrom && bucket.previousTo ? (
        <div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="w-4 border-t border-dashed border-muted-foreground"
              aria-hidden="true"
            />
            {t("insights.salesWorkspace.previous")} ·{" "}
            {range(bucket.previousFrom, bucket.previousTo)}
          </p>
          <p className="mt-1 text-lg font-medium tabular-nums">{amount(bucket.previous)}</p>
        </div>
      ) : null}
    </div>
  );
}
