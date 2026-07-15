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
 * Floating bulk-action bar.
 * Mobile: stacked card with solid fill (no table bleed-through).
 * Desktop: centered pill.
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
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
        className,
      )}
    >
      <div
        className={cn(
          // Solid surface — outline buttons are transparent, so the bar must fully occlude table text.
          "pointer-events-auto flex w-full max-w-lg flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 text-card-foreground shadow-2xl ring-1 ring-black/5",
          "sm:w-auto sm:max-w-[min(42rem,calc(100vw-2rem))] sm:flex-row sm:items-center sm:gap-3 sm:rounded-full sm:px-3 sm:py-2",
          "transition-all duration-200 ease-out",
          isVisible
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-3 scale-95 opacity-0",
        )}
      >
        <div className="flex items-center justify-between gap-2 sm:contents">
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary sm:px-3 sm:text-sm">
            {displayCount} {summaryLabel}
          </span>
          <Button
            aria-label="Clear selection"
            className="shrink-0 sm:order-last"
            onClick={onClearSelection}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <AppIcons.close data-icon="inline-start" />
          </Button>
        </div>

        {isVisible && actions ? (
          <div
            className={cn(
              // Force nested action wrappers (usually a single flex div) to wrap on narrow widths.
              "flex min-w-0 flex-wrap items-center gap-1.5",
              "[&>div]:flex [&>div]:min-w-0 [&>div]:flex-wrap [&>div]:items-center [&>div]:gap-1.5",
              // Opaque faces so table rows never show through outline / soft destructive fills.
              "[&_button[data-variant=outline]]:bg-card",
              "[&_button[data-variant=destructive]]:bg-card",
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
