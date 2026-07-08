"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

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
        "fixed bottom-4 left-1/2 z-50 flex w-fit max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border bg-popover/95 px-3 py-2 text-sm text-popover-foreground shadow-xl shadow-primary/10 ring-1 ring-foreground/10 backdrop-blur transition-all duration-200 ease-out",
        isVisible
          ? "translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-3 scale-95 opacity-0",
        className,
      )}
    >
      <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
        {displayCount} {summaryLabel}
      </span>
      {isVisible && actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      <Button
        aria-label="Clear selection"
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
