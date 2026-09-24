"use client";

import type { InsightsTraffic } from "@ecs/contracts";
import { LaptopIcon, Link2Icon, MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { ListTableSkeleton } from "@/components/app/list-table-skeleton";
import { PaginationBar } from "@/components/app/pagination-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";
import { ReportExportLink } from "./report-export-link";

export function TrafficBreakdown({
  traffic,
  pending,
  search,
  navigate,
  range,
}: {
  traffic: InsightsTraffic;
  pending: boolean;
  search: string;
  navigate: (values: Record<string, string>) => void;
  range: { from: string; to: string };
}) {
  const { t, formatNumber } = useI18n();
  const max = Math.max(1, ...traffic.rows.map((row) => row.visitors));
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="type-section-title">{t("insights.trafficReport.title")}</h2>
        <ReportExportLink report="traffic" range={range} disabled={pending || traffic.status !== "available"} />
      </div>
      {pending ? (
        <ListTableSkeleton rows={5} columns={2} />
      ) : traffic.status !== "available" ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {t(
                traffic.status === "not_configured"
                  ? "insights.trafficReport.notConfigured"
                  : "insights.trafficReport.unavailable",
              )}
            </EmptyTitle>
            <EmptyDescription>{t("insights.trafficReport.unavailableHelp")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {traffic.summary ? (
            <dl className="grid grid-cols-3 gap-4 border-y py-4">
              {(
                [
                  ["visitors", traffic.summary.visitors],
                  ["visits", traffic.summary.visits],
                  ["pageViews", traffic.summary.pageViews],
                ] as const
              ).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground">
                    {t(`insights.trafficReport.${key}`)}
                  </dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="overflow-x-auto pb-1">
            <SegmentedControl
              value={traffic.dimension}
              fullWidth={false}
              size="sm"
              active="muted"
              ariaLabel={t("insights.trafficReport.breakdown")}
              onChange={(trafficDimension) =>
                navigate({ trafficDimension, trafficPage: "1", trafficSearch: "" })
              }
              options={(["referrer", "path", "device"] as const).map((id) => ({
                id,
                label: t(`insights.trafficReport.dimensions.${id}`),
              }))}
            />
          </div>
          {traffic.limited ? (
            <Alert>
              <AlertDescription>
                {t("insights.trafficReport.limited", { count: formatNumber(traffic.limit) })}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <ListToolbarSearch
                label={t("insights.trafficReport.search")}
                placeholder={t("insights.trafficReport.search")}
                value={search}
                clearLabel={t("insights.contributions.clear")}
                onChange={(value) =>
                  navigate({ trafficSearch: value.trim().slice(0, 120), trafficPage: "1" })
                }
              />
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {t(search ? "insights.trafficReport.matches" : "insights.trafficReport.total", {
                  count: formatNumber(traffic.count),
                })}
              </span>
            </div>
            {traffic.rows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t(`insights.trafficReport.dimensions.${traffic.dimension}`)}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("insights.trafficReport.visitors")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traffic.rows.map((row, index) => (
                    <TableRow key={`${row.key}:${index}`}>
                      <TableCell className="max-w-md whitespace-normal break-words">
                        <span className="inline-flex items-center gap-2">
                          <TrafficIcon dimension={traffic.dimension} value={row.key} />
                          {row.key ||
                            t(
                              traffic.dimension === "referrer"
                                ? "insights.trafficReport.direct"
                                : "insights.trafficReport.unknown",
                            )}
                        </span>
                      </TableCell>
                      <TableCell className="w-1/3">
                        <div className="flex items-center justify-end gap-4">
                          <span
                            className="hidden h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted sm:block"
                            aria-hidden
                          >
                            <span
                              className="block h-full rounded-full bg-primary/65"
                              style={{ width: `${(row.visitors / max) * 100}%` }}
                            />
                          </span>
                          <span className="min-w-10 text-right tabular-nums">
                            {formatNumber(row.visitors)}
                            {traffic.summary?.visitors ? (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {Math.round((row.visitors / traffic.summary.visitors) * 100)}%
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t("insights.trafficReport.empty")}</EmptyTitle>
                  <EmptyDescription>{t("insights.trafficReport.emptyHelp")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            <PaginationBar
              className="border-t p-4"
              page={traffic.page}
              totalPages={Math.ceil(traffic.count / traffic.pageSize)}
              onPageChange={(page) => navigate({ trafficPage: String(page) })}
            />
          </div>
        </>
      )}
    </section>
  );
}

function TrafficIcon({ dimension, value }: { dimension: InsightsTraffic["dimension"]; value: string }) {
  const className = "size-4 shrink-0 text-muted-foreground";
  if (dimension === "referrer") return <Link2Icon className={className} aria-hidden />;
  if (dimension !== "device") return null;
  const device = value.toLowerCase();
  if (device.includes("mobile") || device.includes("phone"))
    return <SmartphoneIcon className={className} aria-hidden />;
  if (device.includes("tablet")) return <TabletIcon className={className} aria-hidden />;
  if (device.includes("laptop")) return <LaptopIcon className={className} aria-hidden />;
  return <MonitorIcon className={className} aria-hidden />;
}
