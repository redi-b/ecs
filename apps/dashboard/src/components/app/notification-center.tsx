"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
import { cn } from "@/lib/utils";

type InboxItem = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 45_000;

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const deltaSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(deltaSec);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.min(0, deltaSec), "second");
  if (abs < 3600) return rtf.format(Math.round(deltaSec / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(deltaSec / 3600), "hour");
  if (abs < 86_400 * 7) return rtf.format(Math.round(deltaSec / 86_400), "day");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function badgeLabel(count: number) {
  if (count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}

/**
 * Compact secondary line for the popover: prefer labeled detail rows
 * (Order:, Total:, Customer:) and drop headline/footer prose.
 */
function secondaryBody(item: InboxItem) {
  const body = item.body?.trim() ?? "";
  if (!body) return null;
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title = item.title.trim().toLowerCase();

  const details = lines.filter((line) => {
    const lower = line.toLowerCase();
    if (lower === title) return false;
    if (lower.startsWith("open the order") || lower.startsWith("you can")) return false;
    if (lower.startsWith("no further action") || lower.startsWith("check the order")) return false;
    if (lower.startsWith("you can ignore")) return false;
    // Prefer "Label: value" rows from the rich renderer.
    return line.includes(":");
  });

  const pick = (details.length > 0 ? details : lines.slice(1)).slice(0, 4);
  if (pick.length === 0) return null;
  return pick.join(" · ");
}

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState(false);
  const [busy, setBusy] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  const refreshCount = useCallback(async () => {
    try {
      const response = await fetch("/admin/notifications/inbox?countOnly=true", {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const data = await response.json().catch(() => undefined);
      if (!response.ok) return;
      if (typeof data?.count === "number") {
        setCount(data.count);
      }
    } catch {
      // ignore poll errors
    }
  }, []);

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    setListError(false);
    try {
      const response = await fetch("/admin/notifications/inbox", {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const data = await response.json().catch(() => undefined);
      if (!response.ok) {
        setListError(true);
        return;
      }
      const list = Array.isArray(data?.items) ? (data.items as InboxItem[]) : [];
      setItems(list);
      await refreshCount();
    } catch {
      setListError(true);
    } finally {
      setLoadingList(false);
    }
  }, [refreshCount]);

  useEffect(() => {
    void refreshCount();
    const id = window.setInterval(() => {
      void refreshCount();
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
    if (open) {
      void refreshList();
    }
  }, [open, refreshList]);

  async function markRead(id: string) {
    const target = items.find((item) => item.id === id);
    const wasUnread = Boolean(target && !target.readAt);

    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item,
      ),
    );
    if (wasUnread) {
      setCount((current) => Math.max(0, current - 1));
    }

    setBusy(true);
    try {
      const response = await fetch("/admin/notifications/inbox", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "read", id }),
      });
      if (!response.ok) {
        await refreshList();
      }
    } catch {
      await refreshList();
    } finally {
      setBusy(false);
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

    setBusy(true);
    try {
      const response = await fetch("/admin/notifications/inbox", {
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
      }
    } catch {
      setItems(previousItems);
      setCount(previousCount);
    } finally {
      setBusy(false);
    }
  }

  async function openItem(item: InboxItem) {
    if (!item.readAt) {
      void markRead(item.id);
    }
    setOpen(false);
    if (item.href?.startsWith("/admin")) {
      router.push(item.href);
    }
  }

  const label = badgeLabel(count);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications, none unread"}
          className="relative"
          size="icon"
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
        className="w-[min(100vw-1.5rem,22rem)] gap-0 overflow-hidden p-0"
        sideOffset={8}
      >
        <PopoverHeader className="flex flex-row items-center justify-between gap-2 border-b px-3 py-2.5">
          <div className="min-w-0">
            <PopoverTitle className="text-sm font-semibold">Notifications</PopoverTitle>
            <p className="text-[11px] text-muted-foreground">
              {count === 1 ? "1 unread" : `${count} unread`}
            </p>
          </div>
          <Button
            className="h-7 shrink-0 rounded-full px-2.5 text-xs"
            disabled={busy || count === 0}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => void markAllRead()}
          >
            Mark all read
          </Button>
        </PopoverHeader>

        <div className="max-h-[min(22rem,60vh)] overflow-y-auto">
          {loadingList && items.length === 0 ? (
            <div className="flex flex-col gap-2 px-3 py-3" aria-busy aria-label="Loading">
              {[0, 1, 2].map((key) => (
                <div key={key} className="space-y-1.5 rounded-lg border border-transparent py-1">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted/70" />
                </div>
              ))}
            </div>
          ) : null}

          {listError && items.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium">Couldn’t load notifications</p>
              <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
              <Button
                className="mt-3 rounded-full"
                size="sm"
                type="button"
                variant="outline"
                onClick={() => void refreshList()}
              >
                Try again
              </Button>
            </div>
          ) : null}

          {!loadingList && !listError && items.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-9 text-center">
              <span className="mb-2 flex size-9 items-center justify-center rounded-full border bg-muted/40">
                <AppIcons.notifications className="size-4 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium">All caught up</p>
              <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">
                Order and payment updates for this shop will show up here.
              </p>
            </div>
          ) : null}

          {items.length > 0 ? (
            <ul className="flex flex-col py-1">
              {items.map((item) => {
                const unread = !item.readAt;
                const detail = secondaryBody(item);
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "group/item flex items-stretch",
                      unread && "bg-primary/[0.04]",
                    )}
                  >
                    <button
                      className={cn(
                        "flex min-w-0 flex-1 gap-2.5 px-3 py-2.5 text-left transition-colors",
                        "hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none",
                      )}
                      type="button"
                      onClick={() => void openItem(item)}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          unread ? "bg-primary" : "bg-transparent",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "text-sm leading-snug",
                              unread
                                ? "font-semibold text-foreground"
                                : "font-medium text-foreground/90",
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </span>
                        {detail ? (
                          <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {detail}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {unread ? (
                      <div className="flex shrink-0 items-start pr-1.5 pt-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              aria-label={`Mark “${item.title}” as read`}
                              className="size-7 rounded-full text-muted-foreground hover:text-foreground"
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
                          <TooltipContent side="left">Mark as read</TooltipContent>
                        </Tooltip>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
