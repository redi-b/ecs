"use client";

import { AppIcons } from "@/components/app/icons";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type ListResultsStatusProps = {
  className?: string;
  /**
   * After client-only filters on the current page (secondary chips).
   * When set with hasClientPageFilter, shows page-local refine copy.
   */
  filteredPageCount?: number;
  /** True when any client-only filter is active on the current page. */
  hasClientPageFilter?: boolean;
  /** True when URL/server-backed filters (search, status, …) are active. */
  hasServerFilter?: boolean;
  /** Rows currently rendered (usually the server page size). */
  pageCount: number;
  pending?: boolean;
  /** Honest total from the server (filtered total when filters apply). */
  totalCount: number;
};

/**
 * Toolbar status under search/filters.
 *
 * ListSummary owns the global total. Pagination owns multi-page ranges.
 * This line only speaks for loading, no matches, or client-side refine.
 */
export function ListResultsStatus({
  className,
  filteredPageCount,
  hasClientPageFilter = false,
  hasServerFilter = false,
  pageCount,
  pending = false,
  totalCount,
}: ListResultsStatusProps) {
  const { t, formatNumber } = useI18n();

  if (pending) {
    return (
      <p
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 text-sm text-muted-foreground transition-opacity duration-150",
          className,
        )}
        role="status"
      >
        <AppIcons.loader className="size-3.5 shrink-0 animate-spin opacity-70" aria-hidden />
        <span>{t("common.updating")}</span>
      </p>
    );
  }

  const fmt = (value: number) => formatNumber(value);

  let message: string | null = null;

  if (hasClientPageFilter && filteredPageCount != null) {
    if (filteredPageCount === pageCount) {
      message =
        pageCount === 1
          ? t("common.listStatus.onThisPageOne")
          : t("common.listStatus.onThisPage", { count: fmt(pageCount) });
    } else {
      message = t("common.listStatus.ofOnThisPage", {
        filtered: fmt(filteredPageCount),
        page: fmt(pageCount),
      });
    }
  } else if (hasServerFilter && totalCount === 0) {
    message = t("common.listStatus.noMatches");
  }

  if (!message) return null;

  return (
    <p className={cn("text-sm text-muted-foreground", className)} role="status">
      {message}
    </p>
  );
}
