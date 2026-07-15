"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTableBulkBarProps = {
  actions?: ReactNode;
  className?: string;
  onClearSelection: () => void;
  selectedCount: number;
  summaryLabel?: string;
};

/**
 * Floating bulk-action bar. Positioned for safe mobile widths and home-indicator insets.
 */
export function DataTableBulkBar({
  actions,
  className,
  onClearSelection,
  selectedCount,
  summaryLabel = "selected",
}: DataTableBulkBarProps) {
  const [shouldRender, setShouldRender] = useState(selectedCount > 0);
  const [displayCount, setDisplayCount] = useState(selectedCount);
  const isVisible = selectedCount > 0;

  useEffect(() => {
    if (selectedCount > 0) {
      setDisplayCount(selectedCount);
      setShouldRender(true);
      return;
    }

    const timeout = window.setTimeout(() => setShouldRender(false), 180);

    return () => window.clearTimeout(timeout);
  }, [selectedCount]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        // Mobile: full-width inset, wrap actions. Desktop: centered pill.
        "fixed z-50 flex items-center gap-2 rounded-2xl border bg-popover text-sm text-popover-foreground shadow-md",
        "left-3 right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] max-w-none",
        "flex-wrap justify-between px-2.5 py-2 sm:left-1/2 sm:right-auto sm:w-fit sm:max-w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:flex-nowrap sm:gap-3 sm:rounded-full sm:px-3",
        "transition-all duration-200 ease-out",
        isVisible
          ? "translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-3 scale-95 opacity-0",
        className,
      )}
    >
      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary sm:px-3 sm:text-sm">
        {displayCount} {summaryLabel}
      </span>
      {isVisible && actions ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1 sm:flex-none sm:justify-start">
          {actions}
        </div>
      ) : null}
      <Button
        aria-label="Clear selection"
        className="shrink-0"
        onClick={onClearSelection}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <AppIcons.close data-icon="inline-start" />
      </Button>
    </div>
  );
}
