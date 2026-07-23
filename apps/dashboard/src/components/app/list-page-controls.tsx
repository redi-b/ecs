"use client";

import type * as React from "react";

import { PaginationBar } from "@/components/app/pagination-bar";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";
import { useI18n } from "@/i18n/provider";

const TRANSIENT_STATUS_PARAMS = new Set(["categoryStatus", "collectionStatus", "productStatus"]);

type ListSummaryProps = {
  count: number;
  /**
   * Explicit secondary fact (wins over page/filter auto detail).
   * Prefer real signal: needs-attention, drafts, etc. Prefer nothing over filler.
   */
  detail?: React.ReactNode;
  /** Current page (1-based). With pageSize, shows "Page X of Y" when multi-page. */
  page?: number;
  pageSize?: number;
  /** True when URL/server filters (search, status, …) are active. */
  filtered?: boolean;
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

/**
 * Full-width count strip above list toolbars.
 * Auto detail: page position when multi-page, or "Matching filters" when filtered.
 */
export function ListSummary({
  count,
  detail,
  page,
  pageSize,
  filtered = false,
}: ListSummaryProps) {
  const { t, formatNumber } = useI18n();

  // Count is always the current result set (full catalog or filtered). That is
  // normal: filters change the total. Label as "matches" when filtered so we
  // never show "13 total" + "13 matches" at once.
  let autoDetail: string | null = null;
  if (detail === undefined) {
    if (
      typeof page === "number" &&
      typeof pageSize === "number" &&
      pageSize > 0 &&
      count > pageSize
    ) {
      const totalPages = Math.max(1, Math.ceil(count / pageSize));
      const safePage = Math.min(Math.max(1, page), totalPages);
      autoDetail = t("common.pagination.pageOf", {
        current: formatNumber(safePage),
        total: formatNumber(totalPages),
      });
    }
  }

  const right = detail !== undefined ? detail : autoDetail;

  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/90 px-4 py-2.5 text-sm shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_3%,transparent)]">
      <div className="flex min-w-0 items-baseline gap-2">
        {filtered && count === 0 ? (
          <span className="font-medium text-muted-foreground">
            {t("common.listStatus.noMatches")}
          </span>
        ) : (
          <>
            <span className="text-base font-semibold tabular-nums tracking-tight text-card-foreground">
              {formatNumber(count)}
            </span>
            <span className="text-muted-foreground">
              {filtered
                ? count === 1
                  ? t("common.matchLabel")
                  : t("common.matchesLabel")
                : t("common.totalLabel")}
            </span>
          </>
        )}
      </div>
      {right ? (
        <span className="min-w-0 truncate text-right text-muted-foreground">{right}</span>
      ) : null}
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

  // Single page: ListSummary already owns the total — don't restate "1–N of N".
  // Multi-page: ListSummary shows "Page X of Y"; footer keeps the range.
  const rangeSummary =
    totalPages > 1 ? (
      <span>
        {t("common.showingRange", {
          from: formatNumber(from),
          to: formatNumber(to),
          count: formatNumber(count),
        })}
      </span>
    ) : undefined;

  return (
    <PaginationBar
      {...(className ? { className } : {})}
      getPageHref={getPageHref}
      page={safePage}
      {...(rangeSummary ? { summary: rangeSummary } : {})}
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
