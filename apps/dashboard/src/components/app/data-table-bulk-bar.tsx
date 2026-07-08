"use client";

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
  if (selectedCount < 1) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-50 flex w-fit max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border bg-popover/95 px-3 py-2 text-sm text-popover-foreground shadow-xl shadow-primary/10 ring-1 ring-foreground/10 backdrop-blur transition-all duration-200",
        className,
      )}
    >
      <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
        {selectedCount} {summaryLabel}
      </span>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
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
