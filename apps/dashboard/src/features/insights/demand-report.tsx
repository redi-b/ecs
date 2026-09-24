"use client";

import type { InsightsDemandReport } from "@ecs/contracts";
import { EyeIcon, PackageIcon, RefreshCwIcon, ShoppingBagIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { HelpTip } from "@/components/app/help-tip";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { ListTableSkeleton } from "@/components/app/list-table-skeleton";
import { PaginationBar } from "@/components/app/pagination-bar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { ProductVariantsPanel, type VariantProduct } from "./product-variants-panel";
import { ReportDateRange } from "./report-date-range";
import { ReportExportLink } from "./report-export-link";

export function DemandReport({ report }: { report: InsightsDemandReport }) {
  const { t, formatNumber } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [variantProduct, setVariantProduct] = useState<VariantProduct | null>(null);
  useEffect(() => { if (!pending) setRefreshing(false); }, [pending]);
  const linkedRows = report.rows.filter((row) => row.productId);
  const olderActivity = report.rows.filter((row) => !row.productId).reduce((sum, row) => sum + row.views + row.cartSessions, 0);
  const maxViews = Math.max(1, ...linkedRows.map((row) => row.views));
  const maxUnits = Math.max(1, ...linkedRows.map((row) => row.units ?? 0));
  const sort = params.get("demandSort") === "units" ? "units" : "views";

  function navigate(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) value ? next.set(key, value) : next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }
  function refresh() {
    setRefreshing(true);
    startTransition(() => router.refresh());
  }
  const value = (number: number | null) => number === null ? t("insights.demand.notAvailable") : formatNumber(number);

  return (
    <div className="flex flex-col gap-5" aria-busy={pending || refreshing}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReportDateRange report={report} pending={pending} onChange={(range) => navigate({ ...range, demandPage: "1" })} />
        <div className="flex items-center gap-1">
          <ReportExportLink report="demand" range={report.range} disabled={refreshing || !report.rows.length} />
          <Button variant="outline" disabled={refreshing} onClick={refresh}>
            <RefreshCwIcon data-icon="inline-start" className={cn(refreshing && "animate-spin")} />
            {t("insights.storefrontReport.refresh")}
          </Button>
        </div>
      </div>

      <section className="flex min-w-0 flex-col gap-4" aria-labelledby="product-signals-title">
        <div className="flex items-center gap-2">
          <h2 className="type-section-title" id="product-signals-title">{t("insights.demand.title")}</h2>
          <HelpTip title={t("insights.demand.title")} summary={t("insights.demand.definition")} />
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <ListToolbarSearch label={t("insights.demand.search")} placeholder={t("insights.demand.search")} clearLabel={t("insights.contributions.clear")} value={params.get("demandSearch") ?? ""} onChange={(q) => navigate({ demandSearch: q.trim().slice(0, 120), demandPage: "1" })} />
            <SegmentedControl value={sort} onChange={(demandSort) => navigate({ demandSort, demandPage: "1" })} disabled={pending} fullWidth={false} size="sm" active="muted" ariaLabel={t("insights.demand.sort")} options={[
              { id: "views", label: t("insights.demand.views") }, { id: "units", label: t("insights.demand.units") },
            ]} />
          </div>
          <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-xs text-muted-foreground">
            <span aria-live="polite">{t(params.get("demandSearch") ? "insights.demand.matches" : "insights.demand.total", { count: formatNumber(report.count) })}</span>
            <span>{t("insights.demand.signalHint")}</span>
          </div>
          {pending ? <ListTableSkeleton embedded rows={Math.max(4, Math.min(report.rows.length, 8))} columns={3} /> : !linkedRows.length ? (
            <Empty><EmptyHeader><EmptyTitle>{t("insights.demand.empty")}</EmptyTitle><EmptyDescription>{t("insights.demand.emptyHelp")}</EmptyDescription></EmptyHeader></Empty>
          ) : (
            <div className="divide-y divide-border/60">
              <div className="hidden grid-cols-[minmax(12rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_auto] gap-5 px-4 py-2.5 text-xs text-muted-foreground sm:grid">
                <span>{t("insights.demand.product")}</span><span>{t("insights.demand.views")}</span><span>{t("insights.demand.units")}</span><span className="w-20" />
              </div>
              {linkedRows.map((row) => {
                const title = row.title ?? t("insights.demand.unnamed");
                return <div key={row.key} className="grid gap-4 px-4 py-4 transition-colors hover:bg-muted/25 sm:grid-cols-[minmax(12rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_auto] sm:items-center sm:gap-5">
                  <span className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/35">{row.thumbnail ? <img src={row.thumbnail} alt="" className="size-full object-cover" loading="lazy" /> : <PackageIcon className="size-4 text-muted-foreground" />}</span><span className="truncate text-sm font-medium">{title}</span></span>
                  <SignalLane icon={<EyeIcon />} value={row.views} max={maxViews} formatted={value(row.views)} color="bg-primary" label={t("insights.demand.views")} />
                  <SignalLane icon={<ShoppingBagIcon />} value={row.units ?? 0} max={maxUnits} formatted={value(row.units)} color="bg-emerald-500" label={t("insights.demand.units")} />
                  {pathname.startsWith("/demo/") ? <span /> : <Button variant="outline" size="sm" className="w-fit whitespace-nowrap px-3" onClick={() => setVariantProduct({ id: row.productId!, title })}>{t("insights.variants.open")}</Button>}
                </div>;
              })}
            </div>
          )}
          {olderActivity > 0 ? <div className="border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">{t("insights.demand.olderActivity")}</div> : null}
          <PaginationBar className="border-t p-4" page={report.page} totalPages={Math.ceil(report.count / report.pageSize)} isPending={pending} onPageChange={(page) => navigate({ demandPage: String(page) })} />
        </div>
      </section>
      <ProductVariantsPanel product={variantProduct} range={report.range} tenantId={params.get("tenantId")} onClose={() => setVariantProduct(null)} />
    </div>
  );
}

function SignalLane({ icon, value, max, formatted, color, label }: { icon: React.ReactNode; value: number; max: number; formatted: string; color: string; label: string }) {
  return <span className="flex min-w-0 flex-col gap-1.5 text-xs"><span className="flex items-center justify-between gap-3"><span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground"><span className="[&>svg]:size-3.5" aria-hidden>{icon}</span><span className="truncate">{label}</span></span><span className="font-medium tabular-nums">{formatted}</span></span><span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><span className={cn("block h-full rounded-full", color)} style={{ width: `${Math.max(value ? 4 : 0, Math.min(100, value / max * 100))}%` }} /></span></span>;
}
