"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type DataTableBulkBarProps = {
  actions?: ReactNode;
  className?: string;
  onClearSelection: () => void;
  selectedCount: number;
  /**
   * Text after the count only (e.g. "selected" → "2 selected").
   * Do not include the count — the bar always prefixes `selectedCount`.
   */
  summaryLabel?: string;
};

/**
 * Floating bulk-action bar, portaled to document.body so parent overflow/transforms
 * (e.g. DataTable's overflow-hidden card) cannot clip it.
 *
 * Mobile: full-width dock — summary row + wrapping action chips.
 * Desktop: centered pill.
 *
 * When the mobile sidebar sheet is open, the bar hides so it does not sit above
 * the scrim or steal dismiss events from the sheet.
 */
export function DataTableBulkBar({
  actions,
  className,
  onClearSelection,
  selectedCount,
  summaryLabel,
}: DataTableBulkBarProps) {
  const { t } = useI18n();
  const { isMobile, openMobile } = useSidebar();
  const resolvedSummaryLabel = summaryLabel ?? t("common.selected");
  const [shouldRender, setShouldRender] = useState(selectedCount > 0);
  const [displayCount, setDisplayCount] = useState(selectedCount);
  const [mounted, setMounted] = useState(false);
  const isVisible = selectedCount > 0;
  // Hide above mobile nav sheet (bulk bar stacks higher than the sheet scrim).
  const hiddenForMobileSidebar = isMobile && openMobile;
  const showBar = isVisible && !hiddenForMobileSidebar;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selectedCount > 0) {
      setDisplayCount(selectedCount);
      setShouldRender(true);
      return;
    }

    const timeout = window.setTimeout(() => setShouldRender(false), 180);

    return () => window.clearTimeout(timeout);
  }, [selectedCount]);

  if (!shouldRender || !mounted) {
    return null;
  }

  return createPortal(
    <div
      aria-hidden={!showBar}
      data-slot="data-table-bulk-bar"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-lg rounded-2xl border border-border bg-card text-card-foreground shadow-2xl ring-1 ring-black/5",
          "sm:w-auto sm:max-w-[min(44rem,calc(100vw-1.5rem))] sm:rounded-full",
          "transition-all duration-200 ease-out",
          showBar
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        {/* Mobile: stacked. Desktop: single row via sm:flex */}
        <div className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center sm:gap-2 sm:px-3 sm:py-2">
          <div className="flex items-center justify-between gap-2 sm:contents">
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-primary sm:px-3 sm:text-sm">
              {displayCount} {resolvedSummaryLabel}
            </span>
            <Button
              aria-label={t("common.clearSelection")}
              className="shrink-0 sm:order-last"
              onClick={onClearSelection}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <AppIcons.close data-icon="inline-start" />
            </Button>
          </div>

          {showBar && actions ? (
            <div
              className={cn(
                "grid grid-cols-2 gap-1.5 sm:flex sm:flex-nowrap sm:items-center sm:gap-1.5",

                "[&>div]:contents",

                "[&_button]:w-full sm:[&_button]:w-auto",
                "[&_button[data-variant=outline]]:bg-card",
                "[&_button[data-variant=destructive-outline]]:bg-card",
                "[&_button]:justify-center",
              )}
            >
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
