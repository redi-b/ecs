"use client";

import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import { cn } from "@/lib/utils";

export type DialogStepDef = {
  id: string;
  label: string;
  /** Narrow layouts */
  shortLabel?: string;
};

export type DialogStepStatus = "complete" | "current" | "reachable" | "locked";

type DialogStepRailProps = {
  steps: DialogStepDef[];
  currentId: string;
  /** Resolve status for each step (complete / current / reachable / locked). */
  getStatus: (step: DialogStepDef, index: number) => DialogStepStatus;
  onSelect: (stepId: string) => void;
  className?: string;
  /** Accessible name for the nav landmark. */
  ariaLabel?: string;
  /**
   * rail — full-width segmented bar (product composer)
   * compact — centered nodes with segment connectors (order/promotion)
   */
  variant?: "rail" | "compact";
};

/**
 * Multi-step dialog rail: clickable steps with clear state.
 * All steps stay clickable (cursor: pointer); guards live in `onSelect`.
 */
export function DialogStepRail({
  steps,
  currentId,
  getStatus,
  onSelect,
  className,
  ariaLabel = "Steps",
  variant = "rail",
}: DialogStepRailProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentId),
  );

  if (variant === "compact") {
    return (
      <nav
        aria-label={ariaLabel}
        className={cn("min-w-0 border-b border-border/70 px-4 py-3.5 sm:px-5", className)}
      >
        {/*
          Classic layout: node · connector · node · connector · node
          Fill animates inside each connector (not a line through circles).
        */}
        <ol className="mx-auto flex w-full max-w-lg items-center justify-center">
          {steps.map((step, index) => {
            const status = getStatus(step, index);
            const isCurrent = step.id === currentId || status === "current" || index === currentIndex;
            const isComplete = status === "complete";
            const isLast = index === steps.length - 1;
            const muted = status === "locked" || status === "reachable";
            // Segment after this node is filled once we've moved past it.
            const segmentFilled = index < currentIndex;

            return (
              <li className="flex min-w-0 items-center" key={step.id}>
                <button
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-left outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    isCurrent && "text-foreground",
                    isComplete && !isCurrent && "text-primary hover:text-primary",
                    muted && !isCurrent && "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => onSelect(step.id)}
                  type="button"
                >
                  <StepMarker
                    index={index}
                    size="sm"
                    status={isCurrent ? "current" : status}
                  />
                  <span className="whitespace-nowrap text-xs font-medium sm:text-sm">
                    {step.shortLabel ?? step.label}
                  </span>
                </button>

                {!isLast ? (
                  <span
                    aria-hidden
                    className="relative mx-2 h-0.5 w-8 shrink-0 overflow-hidden rounded-full bg-border sm:mx-3 sm:w-12"
                  >
                    <span
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                        segmentFilled ? "w-full" : "w-0",
                      )}
                    />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label={ariaLabel} className={cn("min-w-0", className)}>
      <ol
        className="grid border-b border-border/70"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, steps.length)}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, index) => {
          const status = getStatus(step, index);
          const isCurrent = step.id === currentId || status === "current";
          const isComplete = status === "complete";
          const muted = status === "locked" || status === "reachable";

          return (
            <li className="min-w-0 border-r border-border/60 last:border-r-0" key={step.id}>
              <button
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex min-h-12 w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1 px-1.5 py-2 text-xs outline-none transition-colors sm:min-h-[3.25rem] sm:flex-row sm:gap-2 sm:px-3 sm:text-sm",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  isCurrent && "bg-muted/80 text-foreground",
                  isComplete && !isCurrent && "text-primary hover:bg-muted/40",
                  muted &&
                    !isCurrent &&
                    "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
                onClick={() => onSelect(step.id)}
                type="button"
              >
                <StepMarker
                  index={index}
                  status={isCurrent ? "current" : status}
                />
                <span className="max-w-full truncate sm:hidden">
                  {step.shortLabel ?? step.label}
                </span>
                <span className="hidden max-w-full truncate sm:inline">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepMarker({
  index,
  status,
  size = "md",
}: {
  index: number;
  status: DialogStepStatus | "current";
  size?: "sm" | "md";
}) {
  const complete = status === "complete";
  const current = status === "current";
  const locked = status === "locked";

  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-card font-semibold tabular-nums transition-[transform,background-color,box-shadow,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        size === "sm" ? "size-6 text-[10px]" : "size-5 text-[10px] sm:size-6 sm:text-[11px]",
        complete && "bg-primary text-primary-foreground",
        current &&
          "z-[1] scale-105 bg-primary text-primary-foreground shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_16%,transparent)]",
        !complete &&
          !current &&
          !locked &&
          "text-muted-foreground ring-1 ring-border",
        locked && "text-muted-foreground/80 ring-1 ring-border/80",
      )}
    >
      {complete ? (
        <AppIcons.check className="size-3 sm:size-3.5" data-icon="inline-start" />
      ) : (
        index + 1
      )}
    </span>
  );
}

/**
 * Fade/slide panel when multi-step dialog content changes.
 * Key by step id so React remounts and re-runs the enter animation.
 */
export function DialogStepPanel({
  stepKey,
  children,
  className,
}: {
  stepKey: string | number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div key={stepKey} className={cn("animate-dialog-step-in", className)}>
      {children}
    </div>
  );
}

/**
 * Highest index the user may jump to without re-validating (completed + next).
 * Forward jumps beyond this should still be attempted — caller validates path.
 */
export function getHighestReachableIndex(completedIndexes: number[], currentIndex: number) {
  const maxCompleted = completedIndexes.length
    ? Math.max(...completedIndexes)
    : -1;
  return Math.max(currentIndex, maxCompleted + 1);
}

export function getDialogStepStatus(options: {
  index: number;
  currentIndex: number;
  completedIndexes: number[];
}): DialogStepStatus {
  const { index, currentIndex, completedIndexes } = options;
  if (index === currentIndex) return "current";
  if (completedIndexes.includes(index)) return "complete";
  const reachable = getHighestReachableIndex(completedIndexes, currentIndex);
  if (index <= reachable) return "reachable";
  return "locked";
}
