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
  disabled?: boolean;
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
  disabled = false,
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
        "relative grid rounded-full border p-0.5",
        fullWidth ? "w-full" : "w-max max-w-full",
        size === "sm" ? "h-8" : "h-9",
        active === "primary" ? "border-border/80 bg-muted/55" : "border-border/80 bg-muted/45",
        className,
      )}
      role="tablist"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0.5 left-0.5 rounded-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
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
            disabled={disabled}
            tabIndex={isActive ? 0 : -1}
            className={cn(
              "relative z-10 flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none",
              fullWidth ? "min-w-0" : "min-w-8",
              size === "sm" ? "text-xs" : "text-sm",
              isActive
                ? active === "primary"
                  ? "text-primary-foreground"
                  : "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            key={option.id}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => {
              const index = options.indexOf(option);
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % count
                  : event.key === "ArrowLeft"
                    ? (index + count - 1) % count
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? count - 1
                        : null;
              if (next === null || !options[next]) return;
              event.preventDefault();
              onChange(options[next].id);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>("button")
                [next]?.focus();
            }}
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
