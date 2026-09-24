"use client";

import { RiLoader4Line } from "@remixicon/react";
import { cn } from "@/lib/utils";

export function TranslationSheetLoadingNotice({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <output
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute top-2 left-1/2 z-20 flex w-max max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur",
        className,
      )}
    >
      <RiLoader4Line className="size-3.5 animate-spin text-primary" aria-hidden />
      {label}
    </output>
  );
}

export function TranslationSheetLoadingFields({
  label,
  count = 2,
}: {
  label: string;
  count?: number;
}) {
  const rows = Array.from({ length: count }, (_, index) => `translation-loading-row-${index + 1}`);

  return (
    <output className="block space-y-4" aria-label={label}>
      {rows.map((row) => (
        <div className="space-y-2" key={row}>
          <div className="h-4 w-28 animate-pulse rounded-md bg-muted/70" />
          <div className="h-20 animate-pulse rounded-xl border bg-muted/35" />
          <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
        </div>
      ))}
    </output>
  );
}
