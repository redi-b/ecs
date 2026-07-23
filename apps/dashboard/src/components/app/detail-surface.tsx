import type { ReactNode } from "react";

import { HelpTip } from "@/components/app/help-tip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DetailHeroProps = {
  children: ReactNode;
  /** Primary actions / next-step panel (right on large screens). */
  actions?: ReactNode;
  className?: string;
};

/**
 * Top strip on detail pages.
 * With `actions`, uses a two-zone layout: identity left, actions right (separated).
 * Without `actions`, a single dense content block.
 */
export function DetailHero({ children, actions, className }: DetailHeroProps) {
  return (
    <Card className={cn(className)} size="default">
      <div className="px-(--card-spacing) py-0.5">
        {actions ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,21rem)] lg:items-stretch lg:gap-8">
            <div className="flex min-w-0 flex-col justify-center gap-5 py-1">{children}</div>
            <div className="flex min-w-0 flex-col border-border/60 lg:border-l lg:pl-7">
              {actions}
            </div>
          </div>
        ) : (
          <div className="min-w-0 py-1">{children}</div>
        )}
      </div>
    </Card>
  );
}

/** Labeled fact cell for hero meta (avoids one-line “name · phone · money · date”). */
export function DetailHeroStat({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="text-sm font-medium leading-snug text-foreground break-words">{value}</div>
    </div>
  );
}

type DetailSectionProps = {
  title: string;
  children: ReactNode;
  /** Optional right-side control (edit, count, help). */
  action?: ReactNode;
  meta?: ReactNode;
  help?: { summary: string; title?: string; body?: string };
  className?: string;
  contentClassName?: string;
};

export function DetailSection({
  title,
  children,
  action,
  meta,
  help,
  className,
  contentClassName,
}: DetailSectionProps) {
  return (
    <Card className={cn(className)} size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/60 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="text-sm font-medium tracking-tight">{title}</CardTitle>
          {action}
          {help ? (
            <HelpTip summary={help.summary} {...(help.title ? { title: help.title } : {})}>
              {help.body}
            </HelpTip>
          ) : null}
        </div>
        {meta ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-xs text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className={cn("space-y-3 pt-3 text-sm", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

type DetailFieldProps = {
  label: string;
  value: ReactNode;
  className?: string;
};

/** Quiet label-over-value cell — no nested bordered box. */
export function DetailField({ label, value, className }: DetailFieldProps) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="break-words text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function DetailFieldGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2", className)}>{children}</div>
  );
}

export function DetailMetric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-foreground/[0.05]",
        className,
      )}
    >
      <p className="text-[11px] leading-none text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

type DetailActivityItem = {
  label: string;
  at: ReactNode;
};

export function DetailActivityList({
  items,
  empty,
}: {
  items: DetailActivityItem[];
  empty?: ReactNode;
}) {
  if (items.length === 0) {
    return empty ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : null;
  }

  return (
    <ol className="space-y-0">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li className="flex gap-3" key={`${item.label}-${index}`}>
            {/* Rail: dot + segment, centered as one column so alignment stays true */}
            <div className="flex w-3 shrink-0 flex-col items-center self-stretch">
              <span
                aria-hidden
                className="mt-[0.4rem] size-2 shrink-0 rounded-full bg-primary ring-[3px] ring-card"
              />
              {!isLast ? (
                <span aria-hidden className="mt-1 w-px flex-1 bg-border" />
              ) : null}
            </div>
            <div
              className={cn(
                "flex min-w-0 flex-1 items-start justify-between gap-3",
                !isLast && "pb-3.5",
              )}
            >
              <span className="text-sm leading-snug">{item.label}</span>
              <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                {item.at}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Fulfillment pipeline: numbered nodes, checkmarks when done, pulse on current.
 * Not badge pills — those compete with payment status chips.
 */
export function DetailStepTrack({
  steps,
}: {
  steps: Array<{ id: string; label: string; done: boolean; current?: boolean; muted?: boolean }>;
}) {
  return (
    <ol className="flex w-full max-w-lg items-start">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const complete = step.done && !step.current && !step.muted;
        const current = Boolean(step.current) && !step.muted;

        return (
          <li className="flex min-w-0 flex-1 flex-col" key={step.id}>
            <div className="flex items-center">
              <span
                aria-hidden
                className={cn(
                  "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                  step.muted &&
                    "bg-muted text-muted-foreground ring-1 ring-border",
                  complete && "bg-primary text-primary-foreground shadow-sm",
                  current &&
                    "bg-primary text-primary-foreground shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent)]",
                  !complete &&
                    !current &&
                    !step.muted &&
                    "bg-card text-muted-foreground ring-1 ring-border",
                )}
              >
                {complete ? (
                  <svg
                    className="size-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2 h-0.5 min-w-0 flex-1 rounded-full",
                    complete || (step.done && !step.muted)
                      ? "bg-primary/45"
                      : "bg-border",
                  )}
                />
              ) : null}
            </div>
            <span
              className={cn(
                "mt-2 max-w-[5.5rem] text-xs font-medium leading-snug sm:max-w-none",
                step.muted && "text-muted-foreground",
                current && "text-foreground",
                complete && "text-primary",
                !complete && !current && !step.muted && "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** @deprecated Prefer DetailStepTrack — pill chips read as duplicate status badges. */
export function DetailStepPills({
  steps,
}: {
  steps: Array<{ id: string; label: string; done: boolean; muted?: boolean }>;
}) {
  return <DetailStepTrack steps={steps} />;
}
