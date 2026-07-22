"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SegmentedControlOption<T extends string> = {
  id: T;
  label: ReactNode;
  ariaLabel?: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  options: Array<SegmentedControlOption<T>>;
  onChange: (next: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  /** primary = brand thumb; muted = soft raised thumb */
  active?: "primary" | "muted";
  className?: string;
  fullWidth?: boolean;
};

/**
 * Sliding-thumb segmented control.
 * Equal-width segments + translateX so the thumb slides both directions.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = "md",
  active = "primary",
  className,
  fullWidth = true,
}: SegmentedControlProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );
  const count = Math.max(options.length, 1);

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "relative flex overflow-hidden rounded-full border p-0.5",
        fullWidth ? "w-full" : "w-fit",
        size === "sm" ? "h-8" : "h-9",
        active === "primary" ? "border-border/80 bg-muted/55" : "border-border/80 bg-muted/45",
        className,
      )}
      role="tablist"
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0.5 left-0.5 rounded-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
          active === "primary"
            ? "bg-primary shadow-sm ring-1 ring-primary/25"
            : "bg-background shadow-sm ring-1 ring-border",
        )}
        style={{
          width: `calc((100% - 4px) / ${count})`,
          // Literal % values (not CSS vars) so the browser can interpolate both ways.
          transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
        }}
      />
      {options.map((option) => {
        const isActive = option.id === value;
        return (
          <button
            aria-label={option.ariaLabel}
            aria-selected={isActive}
            className={cn(
              "relative z-10 flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 font-medium transition-colors duration-200",
              fullWidth ? "min-w-0" : "min-w-[4.75rem]",
              size === "sm" ? "text-xs" : "text-sm",
              isActive
                ? active === "primary"
                  ? "text-primary-foreground"
                  : "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            key={option.id}
            onClick={() => onChange(option.id)}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
