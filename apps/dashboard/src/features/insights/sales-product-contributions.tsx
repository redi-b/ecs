"use client";

import type { InsightsProductsReport } from "@ecs/contracts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { HelpTip } from "@/components/app/help-tip";
import { InlineDefinition } from "@/components/app/inline-definition";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { ListTableSkeleton } from "@/components/app/list-table-skeleton";
import { PaginationBar } from "@/components/app/pagination-bar";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ProductQuantityRow } from "./product-quantity-row";
import { ProductVariantsPanel, type VariantProduct } from "./product-variants-panel";
import { ReportExportLink } from "./report-export-link";
import { useI18n } from "@/i18n/provider";

export function SalesProductContributions({
  report,
  failed,
}: {
  report: InsightsProductsReport | null;
  failed: boolean;
}) {
  const { locale, t } = useI18n();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [variantProduct, setVariantProduct] = useState<VariantProduct | null>(null);
  const number = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  const date = (value: string) =>
    new Intl.DateTimeFormat(`${locale}-u-ca-gregory`, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T12:00:00Z`));
  function navigate(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }
  const comparing = !!report?.previousRange;
  const quantityScale = Math.max(
    1,
    ...(report?.rows.flatMap((row) => [row.units, row.previousUnits ?? 0]) ?? []),
  );
  return (
    <section
      className="flex min-w-0 flex-col gap-4"
      aria-labelledby="product-contributions-title"
      aria-busy={pending}
    >
      <div className="flex items-center gap-2">
        <h2 className="type-section-title" id="product-contributions-title">
          {t("insights.contributions.title")}
        </h2>
        <HelpTip
          title={t("insights.contributions.title")}
          summary={t("insights.contributions.description")}
        >
          <div className="flex flex-col gap-2">
            <p>{t("insights.contributions.description")}</p>
            <p>{t("insights.contributions.definition")}</p>
          </div>
        </HelpTip>
        {report ? <ReportExportLink report="products" range={report.range} disabled={failed || !report.available} /> : null}
      </div>
      {report?.available ? (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <ListToolbarSearch
              label={t("insights.contributions.search")}
              placeholder={t("insights.contributions.search")}
              clearLabel={t("insights.contributions.clear")}
              value={params.get("productSearch") ?? ""}
              onChange={(value) =>
                navigate({ productSearch: value.trim().slice(0, 120), productPage: "1" })
              }
            />
            {report.comparisonAvailable ? (
              <SegmentedControl
                ariaLabel={t("insights.contributions.sort")}
                active="muted"
                fullWidth={false}
                size="sm"
                disabled={pending}
                value={params.get("productSort") === "change" ? "change" : "units"}
                onChange={(sort) => navigate({ productSort: sort, productPage: "1" })}
                options={[
                  { id: "units", label: t("insights.contributions.mostUnits") },
                  { id: "change", label: t("insights.contributions.biggestChange") },
                ]}
              />
            ) : null}
          </div>
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 text-xs text-muted-foreground"
            aria-live="polite"
          >
            <span>
              {t(
                params.get("productSearch")
                  ? "insights.contributions.matches"
                  : "insights.contributions.total",
                { count: report.count },
              )}
            </span>
            <span>
              {date(report.range.from)} – {date(report.range.to)}
            </span>
          </div>
          {pending ? (
            <ListTableSkeleton
              embedded
              columns={comparing ? 4 : 2}
              rows={Math.max(3, Math.min(report.rows.length, 10))}
            />
          ) : report.rows.length ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="h-1.5 w-5 rounded-full bg-primary" />
                    <InlineDefinition content={`${date(report.range.from)} – ${date(report.range.to)}`}>
                      {t("insights.contributions.thisPeriod")}
                    </InlineDefinition>
                  </span>
                  {comparing ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-1.5 w-5 rounded-full border border-muted-foreground/60"
                      />
                      <InlineDefinition content={`${date(report.previousRange!.from)} – ${date(report.previousRange!.to)}`}>
                        {t("insights.contributions.previous")}
                      </InlineDefinition>
                    </span>
                  ) : null}
                </div>
                <InlineDefinition content={t("insights.contributions.scaleHelp")}>
                  {t("insights.contributions.scale", { max: number(quantityScale) })}
                </InlineDefinition>
              </div>
              <ul className="divide-y divide-border/60">
                {report.rows.map((row) => (
                  <li key={row.productId}>
                    <ProductQuantityRow
                      row={row}
                      comparing={comparing}
                      scale={quantityScale}
                      onOpenVariants={pathname.startsWith("/demo/") ? undefined : (id) => setVariantProduct({
                        id,
                        title: row.title ?? t("insights.contributions.unnamed"),
                      })}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t("insights.contributions.empty")}</EmptyTitle>
                <EmptyDescription>{t("insights.contributions.emptyDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <PaginationBar
            className="border-t p-4"
            page={report.page}
            totalPages={Math.ceil(report.count / report.pageSize)}
            isPending={pending}
            onPageChange={(page) => navigate({ productPage: String(page) })}
          />
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {t(failed ? "insights.contributions.failed" : "insights.contributions.preparing")}
            </EmptyTitle>
            <EmptyDescription>
              {t(failed ? "insights.contributions.retry" : "insights.contributions.coverage")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <ProductVariantsPanel
        product={variantProduct}
        range={report?.range ?? { from: "", to: "" }}
        tenantId={params.get("tenantId")}
        onClose={() => setVariantProduct(null)}
      />
    </section>
  );
}
