"use client";

import type { InsightsStorefrontReport } from "@ecs/contracts";
import { RefreshCwIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { HelpTip } from "@/components/app/help-tip";
import { PaginationBar } from "@/components/app/pagination-bar";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { ListTableSkeleton } from "@/components/app/list-table-skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { ReportDateRange } from "./report-date-range";
import { TrafficBreakdown } from "./traffic-breakdown";
import { ReportExportLink } from "./report-export-link";

export function StorefrontReport({ report }: { report: InsightsStorefrontReport }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [pendingScope, setPendingScope] = useState<"all" | "traffic" | "paths" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { if (!pending) { setPendingScope(null); setRefreshing(false); } }, [pending]);
  function navigate(values: Record<string, string>, scope: "all" | "traffic" | "paths" = "all") {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setPendingScope(scope);
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const max = Math.max(
    1,
    ...report.stages.flatMap((stage) => [stage.sessions, stage.previousSessions ?? 0]),
  );
  return (
    <div className="flex flex-col gap-5" aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ReportDateRange
          report={report}
          pending={pending}
          onChange={(range) => navigate({ ...range, pathPage: "1", trafficPage: "1" }, "all")}
        />
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <Switch
              id="storefront-comparison"
              checked={!!report.previousRange}
              disabled={pending}
              onCheckedChange={(checked) =>
                navigate({ comparison: checked ? "previous" : "none", pathPage: "1" }, "all")
              }
            />
            <Label htmlFor="storefront-comparison">
              {t("insights.storefrontReport.compareActivity")}
            </Label>
          </div>
          <Button
            variant="outline"
            disabled={refreshing}
            onClick={() => { setRefreshing(true); startTransition(() => router.refresh()); }}
          >
            <RefreshCwIcon data-icon="inline-start" />
            {t("insights.storefrontReport.refresh")}
          </Button>
        </div>
      </div>
      {report.traffic ? (
        <TrafficBreakdown
          traffic={report.traffic}
          range={report.range}
          pending={pendingScope === "all" || pendingScope === "traffic"}
          search={params.get("trafficSearch") ?? ""}
          navigate={(values) => navigate(values, "traffic")}
        />
      ) : null}
      <div className="flex items-center gap-2">
        <h2 className="type-section-title">{t("insights.storefrontReport.title")}</h2>
        <HelpTip summary={t("insights.storefrontReport.definition")} />
      </div>
      {pendingScope === "all" ? (
        <ListTableSkeleton rows={5} columns={3} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-end gap-4 border-b px-4 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-5 rounded-full bg-primary" aria-hidden />
              {t("insights.contributions.thisPeriod")}
            </span>
            {report.previousRange ? (
              <span className="flex items-center gap-2">
                <span
                  className="h-1.5 w-5 rounded-full border border-muted-foreground"
                  aria-hidden
                />
                {t("insights.contributions.previous")}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col divide-y divide-border/60">
            {report.stages.map((stage) => (
              <button
                key={stage.key}
                type="button"
                aria-pressed={report.stage === stage.key}
                onClick={() => navigate({ stage: stage.key, pathPage: "1", pathSearch: "" }, "paths")}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_minmax(4rem,2fr)_4rem] items-center gap-4 px-4 py-4 text-left text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  report.stage === stage.key && "bg-accent/45",
                )}
              >
                <span className="font-medium">
                  {t(`insights.storefrontReport.stages.${stage.key}`)}
                </span>
                <span className="flex flex-col gap-2" aria-hidden>
                  <span
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(stage.sessions / max) * 100}%` }}
                  />
                  {stage.previousSessions !== null ? (
                    <span
                      className="h-2 rounded-full border border-muted-foreground/60"
                      style={{
                        width: `${(stage.previousSessions / max) * 100}%`,
                        borderWidth: stage.previousSessions ? 1 : 0,
                      }}
                    />
                  ) : null}
                </span>
                <span className="flex flex-col gap-1 text-right tabular-nums">
                  <span>{number(stage.sessions)}</span>
                  {stage.previousSessions !== null ? (
                    <span className="text-xs text-muted-foreground">
                      {number(stage.previousSessions)}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!pending && report.recordedEvents === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("insights.storefrontReport.noEvents")}</EmptyTitle>
            <EmptyDescription>{t("insights.storefrontReport.noEventsHelp")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="type-section-title">
            {t("insights.storefrontReport.paths", {
              stage: t(`insights.storefrontReport.stages.${report.stage}`),
            })}
          </h2>
          <ReportExportLink report="storefront-paths" range={report.range} disabled={pending} />
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <ListToolbarSearch
              label={t("insights.storefrontReport.search")}
              placeholder={t("insights.storefrontReport.search")}
              clearLabel={t("insights.contributions.clear")}
              value={params.get("pathSearch") ?? ""}
              onChange={(q) => navigate({ pathSearch: q.trim().slice(0, 120), pathPage: "1" }, "paths")}
            />
            <span className="text-xs text-muted-foreground">
              {t("insights.storefrontReport.matches", { count: number(report.count) })}
            </span>
          </div>
          {pendingScope === "all" || pendingScope === "paths" ? (
            <ListTableSkeleton embedded rows={6} columns={2} />
          ) : report.rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("insights.storefrontReport.path")}</TableHead>
                  <TableHead className="text-right">
                    {t("insights.storefrontReport.sessions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.path}>
                    <TableCell className="max-w-md whitespace-normal break-all">
                      {row.path || t("insights.storefrontReport.unknownPath")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {number(row.sessions)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t("insights.storefrontReport.noPaths")}</EmptyTitle>
                <EmptyDescription>{t("insights.contributions.emptyDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <PaginationBar
            className="border-t p-4"
            page={report.page}
            totalPages={Math.ceil(report.count / report.pageSize)}
            isPending={pending}
            onPageChange={(page) => navigate({ pathPage: String(page) }, "paths")}
          />
        </div>
      </section>
    </div>
  );
}
