"use client";

import { PaginationBar } from "@/components/app/pagination-bar";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";
import { useI18n } from "@/i18n/provider";

const TRANSIENT_STATUS_PARAMS = new Set(["categoryStatus", "collectionStatus", "productStatus"]);

type ListSummaryProps = {
  count: number;
  label: string;
};

type PaginationControlsProps = {
  basePath: string;
  count: number;
  page: number;
  pageSize: number;
  /** Must be plain serializable data (no functions) — safe from Server Components. */
  searchParams: DashboardSearchParams;
  className?: string;
};

export function ListSummary({ count, label }: ListSummaryProps) {
  const { t, formatNumber } = useI18n();

  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 text-sm">
      <span className="font-medium text-card-foreground">
        {t("common.total", { count: formatNumber(count) })}
      </span>
      <span className="text-muted-foreground">
        {t("common.showingMerchant", { label })}
      </span>
    </div>
  );
}

export function PaginationControls({
  basePath,
  count,
  page,
  pageSize,
  searchParams,
  className,
}: PaginationControlsProps) {
  const { t, formatNumber } = useI18n();

  // Nothing to page through — empty table panel already covers this state.
  if (count === 0) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(count, safePage * pageSize);

  // Build hrefs on the client so Server Components never pass a function prop.
  function getPageHref(nextPage: number) {
    return buildPageHref(basePath, searchParams, nextPage);
  }

  return (
    <PaginationBar
      {...(className ? { className } : {})}
      getPageHref={getPageHref}
      page={safePage}
      summary={
        <span>
          {t("common.showingRange", {
            from: formatNumber(from),
            to: formatNumber(to),
            count: formatNumber(count),
          })}
        </span>
      }
      totalPages={totalPages}
    />
  );
}

export function buildPageHref(
  basePath: string,
  searchParams: DashboardSearchParams,
  page: number,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key === "page" || TRANSIENT_STATUS_PARAMS.has(key) || value === undefined) {
      continue;
    }

    const nextValue = Array.isArray(value) ? value[0] : value;

    if (nextValue !== undefined) {
      params.set(key, nextValue);
    }
  }

  params.set("page", String(page));

  return `${basePath}?${params.toString()}`;
}

/** @deprecated Use buildPageHref — kept for any external imports. */
export const getPageHref = buildPageHref;
