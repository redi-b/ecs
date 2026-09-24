"use client";

import { insightsProductsReportSchema, type InsightsProductsReport } from "@ecs/contracts";
import { useEffect, useState } from "react";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { ListTableSkeleton } from "@/components/app/list-table-skeleton";
import { PaginationBar } from "@/components/app/pagination-bar";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/i18n/provider";

export type VariantProduct = { id: string; title: string };

export function ProductVariantsPanel({ product, range, tenantId, onClose }: {
  product: VariantProduct | null;
  range: { from: string; to: string };
  tenantId?: string | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [report, setReport] = useState<InsightsProductsReport | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!product) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ productId: product.id, from: range.from, to: range.to, page: String(page), q: search });
    if (tenantId) query.set("tenantId", tenantId);
    setPending(true);
    setFailed(false);
    fetch(`/dashboard/insights/actions/variants?${query}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("request_failed")))
      .then((value) => {
        const parsed = insightsProductsReportSchema.safeParse(value);
        if (!parsed.success) throw new Error("invalid_report");
        setReport(parsed.data);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [page, product, range.from, range.to, search, tenantId]);

  const number = (value: number | null) => value === null
    ? t("insights.salesWorkspace.notAvailable")
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);

  return (
    <Sheet open={!!product} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-hidden sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{product?.title ?? t("insights.variants.title")}</SheetTitle>
          <SheetDescription>{t("insights.variants.description")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex min-w-0 flex-col gap-4 overflow-x-hidden" aria-busy={pending}>
          <ListToolbarSearch label={t("insights.variants.search")} placeholder={t("insights.variants.search")} clearLabel={t("insights.contributions.clear")} value={search} onChange={(value) => { setSearch(value.trim().slice(0, 120)); setPage(1); }} />
          {pending ? <ListTableSkeleton embedded columns={3} rows={5} /> : failed || !report?.available ? (
            <Empty><EmptyHeader><EmptyTitle>{t("insights.contributions.failed")}</EmptyTitle><EmptyDescription>{t("insights.contributions.retry")}</EmptyDescription></EmptyHeader></Empty>
          ) : !report.rows.length ? (
            <Empty><EmptyHeader><EmptyTitle>{t("insights.variants.empty")}</EmptyTitle><EmptyDescription>{t("insights.contributions.emptyDescription")}</EmptyDescription></EmptyHeader></Empty>
          ) : (
            <div className="min-w-0 overflow-x-auto rounded-xl border">
              <Table className="min-w-[32rem]"><TableHeader><TableRow><TableHead>{t("insights.variants.variant")}</TableHead><TableHead className="text-right">{t("insights.contributions.units")}</TableHead><TableHead className="text-right">{t("insights.contributions.paidUnits")}</TableHead></TableRow></TableHeader><TableBody>{report.rows.map((row) => <TableRow key={row.variantId ?? row.productId}><TableCell className="whitespace-normal font-medium">{row.variantTitle || t("insights.variants.unnamed")}</TableCell><TableCell className="text-right tabular-nums">{number(row.units)}</TableCell><TableCell className="text-right tabular-nums">{number(row.paidUnits)}</TableCell></TableRow>)}</TableBody></Table>
            </div>
          )}
        </SheetBody>
        {report?.available && Math.ceil(report.count / report.pageSize) > 1 ? (
          <SheetFooter className="items-center">
            <PaginationBar page={report.page} totalPages={Math.ceil(report.count / report.pageSize)} isPending={pending} onPageChange={setPage} />
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
