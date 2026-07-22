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
 * Sliding-thumb segmented control. Segments are always equal width so the
 * thumb can animate with translateX (required for the slide effect).
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
        active === "primary" ? "border-border/80 bg-muted/50" : "border-border/80 bg-background/70",
        className,
      )}
      role="tablist"
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0.5 left-0.5 rounded-full shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
          active === "primary"
            ? "bg-primary ring-1 ring-primary/20"
            : "bg-muted ring-1 ring-foreground/6",
        )}
        style={{
          width: `calc((100% - 4px) / ${count})`,
          transform: `translate3d(calc(${activeIndex} * 100%), 0, 0)`,
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
              // Equal flex-1 segments keep thumb animation aligned.
              fullWidth ? "min-w-0" : "min-w-[4.25rem]",
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
