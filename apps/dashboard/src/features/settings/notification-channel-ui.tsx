"use client";

import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Shared notification channel UI patterns.
 *
 * Guidelines for every channel card (email, Telegram, future WhatsApp/SMS):
 * 1. Header: title + status badge + icon refresh (no global dirty banner).
 * 2. Targets/destinations: save immediately for discrete actions
 *    (connect, disconnect, enable/pause, single-target input-group Save).
 * 3. Events: local draft + explicit "Save events" only when the selection changed.
 * 4. Destructive actions use destructive styling + confirm dialog.
 * 5. Merchant-facing copy only — no provider/env/worker details.
 */

export const NOTIFICATION_EVENT_OPTIONS = [
  { id: "order.created", label: "New orders" },
  { id: "order.cancelled", label: "Cancelled orders" },
  { id: "payment.paid", label: "Payments received" },
  { id: "payment.failed", label: "Payment failures" },
  { id: "cod_order.created", label: "COD orders" },
] as const;

export const ALWAYS_ON_NOTIFICATION_EVENTS = ["notification.test"] as const;

export function defaultNotificationEvents(): string[] {
  return NOTIFICATION_EVENT_OPTIONS.map((event) => event.id);
}

export function normalizeNotificationEvents(events: string[] | undefined | null): string[] {
  if (!events?.length) {
    return defaultNotificationEvents();
  }
  if (events.includes("*")) {
    return defaultNotificationEvents();
  }
  const selected = NOTIFICATION_EVENT_OPTIONS.map((event) => event.id).filter((id) =>
    events.includes(id),
  );
  return selected.length > 0 ? selected : defaultNotificationEvents();
}

export function buildNotificationEventsPayload(selected: string[]) {
  return [...new Set([...selected, ...ALWAYS_ON_NOTIFICATION_EVENTS])];
}

export function sameNotificationEvents(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

export function isValidNotificationEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function NotificationChannelHeader({
  title,
  description,
  badge,
  refreshing,
  disabled,
  onRefresh,
  refreshLabel = "Refresh",
}: {
  title: string;
  description: string;
  badge?: ReactNode;
  refreshing: boolean;
  disabled?: boolean;
  onRefresh: () => void;
  refreshLabel?: string;
}) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {badge}
        </div>
        <CardDescription>{description}</CardDescription>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-busy={refreshing}
            aria-label={refreshing ? "Refreshing" : refreshLabel}
            className="shrink-0"
            disabled={disabled || refreshing}
            size="icon-sm"
            type="button"
            variant="outline"
            onClick={onRefresh}
          >
            <AppIcons.refresh className={refreshing ? "animate-spin" : undefined} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{refreshing ? "Refreshing" : refreshLabel}</TooltipContent>
      </Tooltip>
    </CardHeader>
  );
}

export function NotificationStatusBadge({
  status,
}: {
  status: "active" | "paused" | "not_set_up";
}) {
  if (status === "active") {
    return <Badge variant="secondary">Active</Badge>;
  }
  if (status === "paused") {
    return <Badge variant="outline">Paused</Badge>;
  }
  return <Badge variant="outline">Not set up</Badge>;
}

export function NotificationAccountCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge variant="outline">
      {count} {count === 1 ? "account" : "accounts"}
    </Badge>
  );
}

export function NotificationAlertsSwitch({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border bg-background px-2.5 py-1">
      <span className="text-xs text-muted-foreground">Alerts</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function NotificationEventPicker({
  events,
  disabled,
  description,
  saving,
  dirty,
  onChange,
  onSave,
}: {
  events: string[];
  disabled?: boolean;
  description: string;
  saving?: boolean;
  dirty: boolean;
  onChange: (events: string[]) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/15 p-4">
      <div>
        <p className="text-sm font-medium">Notify me about</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {NOTIFICATION_EVENT_OPTIONS.map((event) => {
          const checked = events.includes(event.id);
          return (
            <label
              key={event.id}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition-colors",
                checked
                  ? "border-primary/40 bg-primary/5"
                  : "border-border hover:bg-muted/40",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(value) => {
                  onChange(
                    value === true
                      ? [...new Set([...events, event.id])]
                      : events.filter((id) => id !== event.id),
                  );
                }}
              />
              <span>{event.label}</span>
            </label>
          );
        })}
      </div>
      <Button
        className="rounded-full"
        disabled={disabled || saving || !dirty || events.length === 0}
        size="sm"
        type="button"
        onClick={onSave}
      >
        {saving ? "Saving…" : "Save events"}
      </Button>
    </div>
  );
}
