"use client";

import { AppIcons } from "@/components/app/icons";
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
 * Shared list toolbar status under search/filters.
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
        <span>Updating…</span>
      </p>
    );
  }

  let message: string;

  if (hasClientPageFilter && filteredPageCount != null) {
    if (filteredPageCount === pageCount) {
      message =
        pageCount === 1 ? "1 on this page" : `${formatCount(pageCount)} on this page`;
    } else {
      message = `${formatCount(filteredPageCount)} of ${formatCount(pageCount)} on this page`;
    }
  } else if (hasServerFilter) {
    if (totalCount === 0) {
      message = "No matches";
    } else if (pageCount >= totalCount) {
      message = totalCount === 1 ? "1 match" : `${formatCount(totalCount)} matches`;
    } else {
      message = `Showing ${formatCount(pageCount)} of ${formatCount(totalCount)} matches`;
    }
  } else if (totalCount === 0) {
    message = "No results yet";
  } else if (pageCount >= totalCount) {
    message = totalCount === 1 ? "1 total" : `${formatCount(totalCount)} total`;
  } else {
    message = `${formatCount(pageCount)} on this page · ${formatCount(totalCount)} total`;
  }

  return (
    <p className={cn("text-sm text-muted-foreground", className)} role="status">
      {message}
    </p>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en").format(value);
}
