"use client";

import { cn } from "@/lib/utils";

type ListResultsStatusProps = {
  className?: string;
  /**
   * After client-only filters on the current page (stock, media type, etc.).
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
 * Keeps loading and count copy consistent across resources.
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
      <div
        aria-live="polite"
        className={cn("flex items-center gap-2.5 text-sm text-muted-foreground", className)}
        role="status"
      >
        <span
          aria-hidden
          className="relative h-1 w-14 overflow-hidden rounded-full bg-muted"
        >
          <span className="absolute inset-y-0 w-1/2 rounded-full bg-primary motion-safe:animate-[list-status-indeterminate_1.15s_ease-in-out_infinite]" />
        </span>
        <span className="font-medium tracking-tight text-foreground/70">Updating results</span>
      </div>
    );
  }

  let message: string;

  if (hasClientPageFilter && filteredPageCount != null) {
    // Client refine of the current page only — counts are page-local.
    if (filteredPageCount === pageCount) {
      message =
        pageCount === 1 ? "1 on this page" : `${formatCount(pageCount)} on this page`;
    } else {
      message = `${formatCount(filteredPageCount)} of ${formatCount(pageCount)} on this page`;
    }
  } else if (hasServerFilter) {
    // Server already applied filters; totalCount is the filtered universe.
    if (totalCount === 0) {
      message = "No matches";
    } else if (pageCount >= totalCount) {
      // Full result set fits on this page — avoid redundant "3 of 3 matching".
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
