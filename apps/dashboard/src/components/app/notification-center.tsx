"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import {
  claimNotificationPollLease,
  createNotificationPollOwner,
  NOTIFICATION_CHANGED_EVENT,
  notifyInboxChanged,
  openNotificationSync,
} from "@/lib/notification-sync";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type InboxItem = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  href: string | null;
  occurrenceCount?: number;
  priority?: "high" | "normal";
  readAt: string | null;
  seenAt?: string | null;
  createdAt: string;
};

type InboxDetail = {
  label: string;
  value: string;
};

const POLL_MS = 45_000;
const RECENT_ARRIVAL_LIMIT = 6;
const INDIVIDUAL_ARRIVAL_LIMIT = 3;

/** Compact popover: omit these detail labels. */
const SKIP_BODY_PREFIXES = [
  "open the order",
  "you can",
  "no further action",
  "check the order",
  "this was a test",
  "settings >",
  "open settings",
];

/** Priority order when many detail rows exist. */
const DETAIL_PRIORITY = [
  "order",
  "amount",
  "total",
  "customer",
  "items",
  "status",
  "payment",
  "fulfillment",
  "phone",
  "shop",
  "sent to",
];

function formatRelativeTime(iso: string, locale: string, formatDate: (value: string) => string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const deltaSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(deltaSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.min(0, deltaSec), "second");
  if (abs < 3600) return rtf.format(Math.round(deltaSec / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(deltaSec / 3600), "hour");
  if (abs < 86_400 * 7) return rtf.format(Math.round(deltaSec / 86_400), "day");
  return formatDate(iso);
}

export function badgeLabel(count: number) {
  if (count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}

export function collectNotificationArrivals(
  items: InboxItem[],
  knownSignatures: Set<string>,
  announce: boolean,
) {
  const unseen = items.filter((item) => !item.seenAt);
  const arrivals = unseen.filter((item) => {
    const signature = `${item.id}:${item.occurrenceCount ?? 1}`;
    return !knownSignatures.has(signature);
  });
  for (const item of unseen) {
    knownSignatures.add(`${item.id}:${item.occurrenceCount ?? 1}`);
  }
  return announce ? arrivals : [];
}

/**
 * Normalize money strings stored in older notification bodies
 * (e.g. "10880.000000000000" → "ETB 10,880").
 */
export function formatInboxMoney(raw: string, locale = "en"): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // Already labeled (ETB 1,200) or non-numeric prose.
  if (/[a-zA-Z]/.test(trimmed) && !/^\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }

  const numeric = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return trimmed;

  const amount = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(numeric);

  // Bare numbers from order totals are ETB in this product.
  if (/^\d+(\.\d+)?$/.test(trimmed.replace(/,/g, ""))) {
    return `ETB ${amount}`;
  }
  return amount;
}

function formatDetailValue(label: string, value: string, locale: string): string {
  const key = label.trim().toLowerCase();
  if (key === "amount" || key === "total") {
    return formatInboxMoney(value, locale);
  }
  return value.trim();
}

/**
 * Parse multi-line notification bodies into labeled detail rows for the panel.
 * Tolerates both new (Label: value) and older free-form bodies.
 */
export function parseInboxDetails(item: InboxItem, locale = "en"): InboxDetail[] {
  const body = item.body?.trim() ?? "";
  if (!body) return [];

  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title = item.title.trim().toLowerCase();
  const details: InboxDetail[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower === title) continue;
    if (SKIP_BODY_PREFIXES.some((prefix) => lower.startsWith(prefix))) continue;

    const colon = line.indexOf(":");
    if (colon > 0 && colon < 28) {
      const label = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      if (!label || !value) continue;
      const labelKey = label.toLowerCase();
      // Skip provider payment refs and other noisy technical rows.
      if (
        labelKey === "reference" ||
        labelKey === "tx ref" ||
        labelKey === "payment reference" ||
        labelKey === "provider reference"
      ) {
        continue;
      }
      if (looksLikeUglyPaymentRef(value)) {
        continue;
      }
      // Skip redundant order ref already in the title.
      if (labelKey === "order" && title.includes(value.toLowerCase().replace(/^#/, ""))) {
        continue;
      }
      details.push({
        label,
        value: formatDetailValue(label, value, locale),
      });
    }
  }

  if (details.length > 0) {
    return sortDetails(details).slice(0, 3);
  }

  // Fallback: non-labeled body — show a short prose snippet (not the title line).
  const prose = lines.find((line) => line.toLowerCase() !== title);
  if (!prose) return [];
  return [{ label: "", value: prose.length > 96 ? `${prose.slice(0, 93)}…` : prose }];
}

function sortDetails(details: InboxDetail[]): InboxDetail[] {
  return [...details].sort((a, b) => {
    const ai = DETAIL_PRIORITY.indexOf(a.label.toLowerCase());
    const bi = DETAIL_PRIORITY.indexOf(b.label.toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

/** Provider/tx refs that should never clutter the inbox panel. */
function looksLikeUglyPaymentRef(value: string) {
  const v = value.trim();
  if (v.length > 28) return true;
  if (/^(chapa|tx|ecs_|pay_|ref_|tr-)/i.test(v)) return true;
  if (/^[0-9a-f]{16,}$/i.test(v)) return true;
  return false;
}

function eventIcon(eventType: string) {
  const type = eventType.toLowerCase();
  if (type.includes("payment") || type.includes("paid")) return AppIcons.billing;
  if (type.includes("cancel")) return AppIcons.close;
  if (type.includes("order") || type.includes("cod")) return AppIcons.orders;
  if (type.includes("test") || type.includes("telegram")) return AppIcons.notifications;
  return AppIcons.notifications;
}

function eventAccent(eventType: string, unread: boolean) {
  if (!unread) return "bg-muted text-muted-foreground";
  const type = eventType.toLowerCase();
  if (type.includes("payment") || type.includes("paid")) {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400";
  }
  if (type.includes("cancel")) {
    return "bg-destructive/10 text-destructive";
  }
  if (type.includes("order") || type.includes("cod")) {
    return "bg-primary/10 text-primary";
  }
  return "bg-primary/10 text-primary";
}

export function NotificationCenter() {
  const { formatDate, t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Shift panel toward the viewport edge on small screens (lang + theme sit after the bell). */
  const [alignOffset, setAlignOffset] = useState(0);
  const openRef = useRef(open);
  const countRef = useRef(0);
  const arrivalBaselineReadyRef = useRef(false);
  const knownArrivalSignaturesRef = useRef(new Set<string>());
  const syncRef = useRef<BroadcastChannel | null>(null);
  openRef.current = open;

  const presentArrival = useCallback(
    (item: InboxItem) => {
      const href = item.href?.startsWith("/dashboard") ? item.href : null;
      const description = item.body
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line && line.toLowerCase() !== item.title.trim().toLowerCase());
      toast(item.title, {
        ...(description ? { description } : {}),
        duration: item.priority === "high" ? 10_000 : 6_000,
        ...(href
          ? {
              action: {
                label: t("common.inbox.open"),
                onClick: () => {
                  void fetch("/dashboard/notifications/inbox", {
                    body: JSON.stringify({ action: "read", id: item.id }),
                    headers: { "content-type": "application/json" },
                    method: "POST",
                  }).finally(() => {
                    notifyInboxChanged();
                  });
                  router.push(href);
                },
              },
            }
          : {}),
      });
    },
    [router, t],
  );

  const presentArrivalBurst = useCallback(
    (count: number) => {
      toast(t("common.inbox.newNotifications", { count }), {
        description: t("common.inbox.newNotificationsDesc"),
        duration: 10_000,
        action: {
          label: t("common.inbox.viewAll"),
          onClick: () => router.push(dashboardRoutes.notifications),
        },
      });
    },
    [router, t],
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => {
      // ~ language + theme icon buttons + gaps to the right of the bell.
      setAlignOffset(mq.matches ? -72 : 0);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const refreshCount = useCallback(async () => {
    try {
      const response = await fetch(
        "/dashboard/notifications/inbox?countOnly=true&unseenOnly=true",
        {
        headers: { accept: "application/json" },
        cache: "no-store",
        },
      );
      const data = await response.json().catch(() => undefined);
      if (!response.ok) return;
      if (typeof data?.count === "number") {
        const nextCount = data.count;
        const shouldCheckArrivals = !arrivalBaselineReadyRef.current || nextCount > countRef.current;
        setCount(nextCount);
        countRef.current = nextCount;
        syncRef.current?.postMessage({ count: nextCount, type: "count" });

        if (shouldCheckArrivals) {
          const listResponse = await fetch(
            `/dashboard/notifications/inbox?limit=${RECENT_ARRIVAL_LIMIT}`,
            { cache: "no-store", headers: { accept: "application/json" } },
          );
          const listData = await listResponse.json().catch(() => undefined);
          if (listResponse.ok && Array.isArray(listData?.items)) {
            const arrivals = collectNotificationArrivals(
              listData.items as InboxItem[],
              knownArrivalSignaturesRef.current,
              arrivalBaselineReadyRef.current,
            );
            if (arrivalBaselineReadyRef.current && document.hasFocus()) {
              if (arrivals.length > INDIVIDUAL_ARRIVAL_LIMIT) {
                presentArrivalBurst(arrivals.length);
              } else {
                for (const item of arrivals.reverse()) presentArrival(item);
              }
            }
            arrivalBaselineReadyRef.current = true;
          }
        }
      }
    } catch {
      // ignore poll errors
    }
  }, [presentArrival, presentArrivalBurst]);

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    setListError(false);
    try {
      const response = await fetch("/dashboard/notifications/inbox?limit=50", {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const data = await response.json().catch(() => undefined);
      if (!response.ok) {
        setListError(true);
        return;
      }
      const list = Array.isArray(data?.items) ? (data.items as InboxItem[]) : [];
      setItems(list.slice(0, RECENT_ARRIVAL_LIMIT));
      const unseenIds = list.filter((item) => !item.seenAt).map((item) => item.id);
      if (openRef.current && unseenIds.length) {
        const seenResponse = await fetch("/dashboard/notifications/inbox", {
          body: JSON.stringify({ action: "seen", ids: unseenIds }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }).catch(() => undefined);
        if (seenResponse?.ok) {
          const seenAt = new Date().toISOString();
          setItems((current) => current.map((item) => ({ ...item, seenAt: item.seenAt ?? seenAt })));
        }
      }
      await refreshCount();
    } catch {
      setListError(true);
    } finally {
      setLoadingList(false);
    }
  }, [refreshCount]);

  useEffect(() => {
    const owner = createNotificationPollOwner();
    const poll = () => {
      if (
        document.visibilityState === "visible" &&
        claimNotificationPollLease(localStorage, owner, Date.now(), POLL_MS + 10_000)
      ) {
        void refreshCount();
      }
    };
    poll();
    const id = window.setInterval(() => {
      poll();
    }, POLL_MS);

    function onFocus() {
      void refreshCount();
      if (openRef.current) {
        void refreshList();
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        onFocus();
      }
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshCount, refreshList]);

  useEffect(() => {
    const refresh = () => {
      void refreshCount();
      if (openRef.current) void refreshList();
    };
    syncRef.current = openNotificationSync((message) => {
      if (message.type === "count") {
        const increased = message.count > countRef.current;
        setCount(message.count);
        if (increased && document.hasFocus()) void refreshCount();
        else countRef.current = message.count;
      }
      if (message.type === "changed") refresh();
    });
    window.addEventListener(NOTIFICATION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(NOTIFICATION_CHANGED_EVENT, refresh);
      syncRef.current?.close();
      syncRef.current = null;
    };
  }, [refreshCount, refreshList]);

  useEffect(() => {
    if (open) {
      void refreshList();
    }
  }, [open, refreshList]);

  async function markRead(id: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item,
      ),
    );
    setBusy(true);
    try {
      const response = await fetch("/dashboard/notifications/inbox", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "read", id }),
      });
      if (!response.ok) {
        await refreshList();
      } else {
        await refreshCount();
      }
    } catch {
      await refreshList();
    } finally {
      setBusy(false);
      notifyInboxChanged();
    }
  }

  async function markAllRead() {
    const previousItems = items;
    const previousCount = count;
    setItems((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    );
    setCount(0);
    countRef.current = 0;

    setBusy(true);
    try {
      const response = await fetch("/dashboard/notifications/inbox", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "read-all" }),
      });
      if (!response.ok) {
        setItems(previousItems);
        setCount(previousCount);
        countRef.current = previousCount;
      }
    } catch {
      setItems(previousItems);
      setCount(previousCount);
      countRef.current = previousCount;
    } finally {
      setBusy(false);
      notifyInboxChanged();
    }
  }

  async function openItem(item: InboxItem) {
    if (!item.readAt) {
      void markRead(item.id);
    }
    setOpen(false);
    if (item.href?.startsWith("/dashboard")) {
      router.push(item.href);
    }
  }

  const label = badgeLabel(count);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-label={
            count > 0 ? t("common.inbox.unreadAria", { count }) : t("common.inbox.unreadNoneAria")
          }
          className="relative"
          size="icon-lg"
          type="button"
          variant="ghost"
        >
          <span className="relative inline-flex size-4 items-center justify-center">
            <AppIcons.notifications className="size-4" />
            {label ? (
              <span
                aria-hidden
                className={cn(
                  "absolute -top-1.5 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full",
                  "bg-primary px-0.5 text-[9px] font-semibold leading-none text-primary-foreground",
                  "ring-2 ring-background",
                  label.length > 1 && "px-1",
                )}
              >
                {label}
              </span>
            ) : null}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        alignOffset={alignOffset}
        // Near the header edge on phones: stay in viewport and hug the actions cluster.
        avoidCollisions
        collisionPadding={8}
        className={cn(
          "gap-0 overflow-hidden rounded-xl p-0 shadow-lg",
          // Mobile: nearly full-bleed under the header; desktop: fixed card width.
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[24rem] sm:max-w-[24rem]",
        )}
        side="bottom"
        sideOffset={8}
      >
        <PopoverHeader className="flex flex-row items-center justify-between gap-2 border-b bg-muted/20 px-3.5 py-3">
          <div className="min-w-0">
            <PopoverTitle className="text-sm font-semibold tracking-tight">
              {t("common.inbox.title")}
            </PopoverTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {count === 1 ? t("common.inbox.unreadOne") : t("common.inbox.unread", { count })}
            </p>
          </div>
          <Button
            className="h-7 shrink-0 px-2.5 text-xs font-medium"
            disabled={busy || count === 0}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => void markAllRead()}
          >
            {t("common.inbox.markAllRead")}
          </Button>
        </PopoverHeader>

        <div className="max-h-[min(26rem,min(64vh,calc(100dvh-5.5rem)))] overflow-y-auto overscroll-contain">
          {loadingList && items.length === 0 ? (
            <output
              aria-busy
              aria-label={t("common.loading")}
              className="flex flex-col gap-0 px-1 py-1"
            >
              {[0, 1, 2, 3].map((key) => (
                <div key={key} className="flex gap-3 px-3.5 py-3">
                  <div className="mt-0.5 size-8 shrink-0 animate-pulse rounded-full bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex justify-between gap-3">
                      <div className="h-3.5 w-[55%] animate-pulse rounded bg-muted" />
                      <div className="h-3 w-14 animate-pulse rounded bg-muted/70" />
                    </div>
                    <div className="h-3 w-[70%] animate-pulse rounded bg-muted/70" />
                    <div className="h-3 w-[42%] animate-pulse rounded bg-muted/60" />
                  </div>
                </div>
              ))}
            </output>
          ) : null}

          {listError && items.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium">{t("common.inbox.loadErrorTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("common.inbox.loadErrorDesc")}
              </p>
              <Button
                className="mt-3 rounded-full"
                size="sm"
                type="button"
                variant="outline"
                onClick={() => void refreshList()}
              >
                {t("common.tryAgain")}
              </Button>
            </div>
          ) : null}

          {!loadingList && !listError && items.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-9 text-center">
              <span className="mb-2 flex size-9 items-center justify-center rounded-full border bg-muted/40">
                <AppIcons.notifications className="size-4 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium">{t("common.inbox.emptyTitle")}</p>
              <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">
                {t("common.inbox.emptyDesc")}
              </p>
            </div>
          ) : null}

          {items.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border/60">
              {items.map((item) => {
                const unread = !item.readAt;
                const details = parseInboxDetails(item, locale);
                const Icon = eventIcon(item.eventType);
                return (
                  <li
                    key={item.id}
                    className={cn("group/item relative", unread && "bg-primary/[0.04]")}
                  >
                    {/* Open row — simple flex, no reserved action column. */}
                    <button
                      className={cn(
                        "flex w-full gap-3 px-3.5 py-3 text-left transition-colors",
                        "hover:bg-muted/55 focus-visible:bg-muted/55 focus-visible:outline-none",
                      )}
                      type="button"
                      onClick={() => void openItem(item)}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          // Align with the title line (first line of content).
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                          eventAccent(item.eventType, unread),
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span
                            className={cn(
                              "min-w-0 text-sm leading-snug",
                              unread
                                ? "font-semibold text-foreground"
                                : "font-medium text-foreground/90",
                            )}
                          >
                            {item.title}
                          </span>
                          {(item.occurrenceCount ?? 1) > 1 ? (
                            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {t("common.inbox.occurrences", {
                                count: item.occurrenceCount ?? 1,
                              })}
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              "shrink-0 text-[11px] tabular-nums whitespace-nowrap text-muted-foreground transition-opacity",

                              unread &&
                                "pr-8 sm:pr-0 sm:group-hover/item:opacity-0 sm:group-focus-within/item:opacity-0",
                            )}
                          >
                            {formatRelativeTime(item.createdAt, locale, formatDate)}
                          </span>
                        </span>

                        {details.length > 0 ? (
                          <span className="mt-1 flex flex-col gap-0.5">
                            {details.map((detail) =>
                              detail.label ? (
                                <span
                                  className="flex min-w-0 items-baseline gap-1.5 text-xs leading-snug"
                                  key={`${detail.label}:${detail.value}`}
                                >
                                  <span className="shrink-0 text-muted-foreground">
                                    {detail.label}
                                  </span>
                                  <span className="min-w-0 truncate font-medium text-foreground/80">
                                    {detail.value}
                                  </span>
                                </span>
                              ) : (
                                <span
                                  className="line-clamp-2 text-xs leading-relaxed text-muted-foreground"
                                  key={detail.value}
                                >
                                  {detail.value}
                                </span>
                              ),
                            )}
                          </span>
                        ) : null}
                      </span>
                    </button>

                    {/* Absolute mark-read — never takes layout space. */}
                    {unread ? (
                      <div
                        className={cn(
                          "absolute top-2.5 right-2.5 z-10 transition-opacity",
                          // Desktop: only on hover/focus. Mobile: always (no hover).
                          "opacity-100 sm:opacity-0",
                          "sm:group-hover/item:opacity-100 sm:group-focus-within/item:opacity-100",
                        )}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              aria-label={t("common.inbox.markItemReadAria", {
                                title: item.title,
                              })}
                              className="size-7 bg-popover/95 text-muted-foreground shadow-sm ring-1 ring-border/60 hover:bg-background hover:text-foreground"
                              disabled={busy}
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void markRead(item.id);
                              }}
                            >
                              <AppIcons.check className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {t("common.inbox.markAsRead")}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <div className="border-t bg-muted/15 p-2">
          <Button asChild className="w-full" size="sm" variant="ghost">
            <Link href={dashboardRoutes.notifications} onClick={() => setOpen(false)}>
              {t("common.inbox.viewAll")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
