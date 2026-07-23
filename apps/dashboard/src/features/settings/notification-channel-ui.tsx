"use client";

import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
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
  { id: "order.created", labelKey: "settings.notifications.events.orderCreated" as MessageKey },
  { id: "order.cancelled", labelKey: "settings.notifications.events.orderCancelled" as MessageKey },
  { id: "payment.paid", labelKey: "settings.notifications.events.paymentPaid" as MessageKey },
  { id: "payment.failed", labelKey: "settings.notifications.events.paymentFailed" as MessageKey },
  { id: "inventory.low", labelKey: "settings.notifications.events.inventoryLow" as MessageKey },
  { id: "billing.past_due", labelKey: "settings.notifications.events.billingPastDue" as MessageKey },
  {
    id: "billing.invoice_ready",
    labelKey: "settings.notifications.events.billingInvoiceReady" as MessageKey,
  },
] as const;

/** Group labels for the event picker — commerce (shop ops) vs system (account/billing). */
export const NOTIFICATION_EVENT_GROUPS = [
  {
    id: "commerce",
    labelKey: "settings.notifications.eventGroups.commerce" as MessageKey,
    descriptionKey: "settings.notifications.eventGroups.commerceDesc" as MessageKey,
    eventIds: [
      "order.created",
      "order.cancelled",
      "payment.paid",
      "payment.failed",
      "inventory.low",
    ] as const,
  },
  {
    id: "system",
    labelKey: "settings.notifications.eventGroups.system" as MessageKey,
    descriptionKey: "settings.notifications.eventGroups.systemDesc" as MessageKey,
    eventIds: ["billing.past_due", "billing.invoice_ready"] as const,
  },
] as const;

/** Legacy pref id still stored for some tenants; treated as order.created. */
export const LEGACY_COD_ORDER_EVENT = "cod_order.created";

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
  const expanded = events.flatMap((id) =>
    id === LEGACY_COD_ORDER_EVENT ? ["order.created"] : [id],
  );
  const selected = NOTIFICATION_EVENT_OPTIONS.map((event) => event.id).filter((id) =>
    expanded.includes(id),
  );
  return selected.length > 0 ? selected : defaultNotificationEvents();
}

export function buildNotificationEventsPayload(selected: string[]) {
  // Drop legacy COD event; order.created covers COD via payload.paymentMethod.
  const cleaned = selected.filter((id) => id !== LEGACY_COD_ORDER_EVENT);
  return [...new Set([...cleaned, ...ALWAYS_ON_NOTIFICATION_EVENTS])];
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
  refreshLabel,
}: {
  title: string;
  description: string;
  badge?: ReactNode;
  refreshing: boolean;
  disabled?: boolean;
  onRefresh: () => void;
  refreshLabel?: string;
}) {
  const { t } = useI18n();
  const resolvedRefresh = refreshLabel ?? t("settings.notifications.refresh");
  const refreshingLabel = t("settings.notifications.refreshing");

  return (
    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border/60 pb-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm font-medium tracking-tight">{title}</CardTitle>
          {badge}
        </div>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-busy={refreshing}
            aria-label={refreshing ? refreshingLabel : resolvedRefresh}
            className="shrink-0 rounded-full"
            disabled={disabled || refreshing}
            size="icon-sm"
            type="button"
            variant="outline"
            onClick={onRefresh}
          >
            <AppIcons.refresh className={refreshing ? "animate-spin" : undefined} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{refreshing ? refreshingLabel : resolvedRefresh}</TooltipContent>
      </Tooltip>
    </CardHeader>
  );
}

export function NotificationStatusBadge({
  status,
}: {
  status: "active" | "paused" | "not_set_up";
}) {
  const { t } = useI18n();
  if (status === "active") {
    return <Badge variant="success">{t("settings.notifications.status.active")}</Badge>;
  }
  if (status === "paused") {
    return <Badge variant="warning">{t("settings.notifications.status.paused")}</Badge>;
  }
  return <Badge variant="outline">{t("settings.notifications.status.notSetUp")}</Badge>;
}

export function NotificationAccountCountBadge({ count }: { count: number }) {
  const { t } = useI18n();
  if (count <= 0) return null;
  return (
    <Badge variant="outline">
      {count}{" "}
      {count === 1
        ? t("settings.notifications.accountOne")
        : t("settings.notifications.accountMany")}
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
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-2.5 py-1 shadow-xs">
      <span className="text-xs text-muted-foreground">{t("settings.notifications.alerts")}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/**
 * Soft merchant-facing state when a channel is not configured on the deployment.
 * Do not mention env vars, providers, or server setup.
 */
export function NotificationChannelUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center">
      <div className="flex size-11 items-center justify-center rounded-full border bg-background shadow-sm">
        <AppIcons.notifications className="size-5 text-muted-foreground" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
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
  const { t } = useI18n();
  const eventById = new Map(NOTIFICATION_EVENT_OPTIONS.map((event) => [event.id, event]));

  return (
    <div className="space-y-3.5 rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium tracking-tight">
          {t("settings.notifications.notifyAbout")}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3.5">
        {NOTIFICATION_EVENT_GROUPS.map((group) => (
          <div key={group.id} className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t(group.labelKey)}
              </p>
              <p className="text-xs text-muted-foreground">{t(group.descriptionKey)}</p>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {group.eventIds.map((eventId) => {
                const event = eventById.get(eventId);
                if (!event) return null;
                const checked = events.includes(event.id);
                return (
                  <label
                    key={event.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-3 py-2 text-sm transition-colors",
                      checked
                        ? "border-primary/40 bg-primary/[0.06] text-foreground shadow-xs"
                        : "border-border/70 text-foreground hover:border-border hover:bg-muted/30",
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
                    <span className="leading-snug">{t(event.labelKey)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* Nested panel stays; save only when the draft differs. */}
      {dirty ? (
        <Button
          className="rounded-full"
          disabled={disabled || saving || events.length === 0}
          size="sm"
          type="button"
          onClick={onSave}
        >
          {saving ? t("common.saving") : t("settings.notifications.saveEvents")}
        </Button>
      ) : null}
    </div>
  );
}
