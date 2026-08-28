"use client";

import { ChevronDownIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { type ActivityStatus, useGlobalActivities } from "@/components/app/activity-registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ActivityDock() {
  const activities = useGlobalActivities();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const activeIds = new Set(activities.map((activity) => activity.id));
    setCollapsed((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id))),
    );
  }, [activities]);

  if (!activities.length) return null;

  return (
    <aside
      aria-live="polite"
      aria-label="Background activity"
      className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {activities.map((activity) => (
        <ActivityPanel
          badgeLabel={activity.badgeLabel}
          collapsed={collapsed[activity.id] ?? false}
          description={activity.description}
          dismissLabel={activity.dismiss?.label}
          icon={activity.icon}
          key={activity.id}
          onCollapsedChange={(next) =>
            setCollapsed((current) => ({ ...current, [activity.id]: next }))
          }
          onDismiss={activity.dismiss?.onSelect}
          progress={activity.progress}
          status={activity.status}
          title={activity.title}
        >
          {activity.details}
        </ActivityPanel>
      ))}
    </aside>
  );
}

export function ActivityPanel({
  badgeLabel,
  children,
  collapsed,
  description,
  dismissLabel,
  icon,
  onCollapsedChange,
  onDismiss,
  progress,
  status,
  title,
}: {
  badgeLabel?: string | undefined;
  children?: ReactNode | undefined;
  collapsed: boolean;
  description: string;
  dismissLabel?: string | undefined;
  icon: ReactNode;
  onCollapsedChange: (collapsed: boolean) => void;
  onDismiss?: (() => void) | undefined;
  progress?: number | undefined;
  status: ActivityStatus;
  title: string;
}) {
  const boundedProgress = progress === undefined ? undefined : Math.min(100, Math.max(0, progress));
  const badgeVariant =
    status === "error" ? "destructive" : status === "success" ? "success" : "info";

  return (
    <section className="pointer-events-auto overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-[var(--ease-dashboard)]">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg border bg-background">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant={badgeVariant}>{badgeLabel ?? `${boundedProgress ?? 0}%`}</Badge>
        {children ? (
          <Button
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Show ${title}` : `Hide ${title} details`}
            onClick={() => onCollapsedChange(!collapsed)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <ChevronDownIcon
              className={cn(
                "transition-transform duration-200 ease-[var(--ease-dashboard)]",
                !collapsed && "rotate-180",
              )}
            />
          </Button>
        ) : null}
        {onDismiss ? (
          <Button
            aria-label={dismissLabel ?? `Dismiss ${title}`}
            onClick={onDismiss}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
      {boundedProgress === undefined ? null : (
        <div className="h-1 bg-muted">
          <div
            className={cn(
              "h-full transition-[width] duration-300 ease-[var(--ease-dashboard)]",
              badgeVariant === "destructive" ? "bg-destructive" : "bg-primary",
            )}
            style={{ width: `${boundedProgress}%` }}
          />
        </div>
      )}
      {children ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-[var(--ease-dashboard)]",
            collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">{children}</div>
        </div>
      ) : null}
    </section>
  );
}
