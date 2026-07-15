"use client";

import { useCallback, useEffect, useState } from "react";
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
  if (abs < 60) return rtf.format(deltaSec, "second");
  if (abs < 3600) return rtf.format(Math.round(deltaSec / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(deltaSec / 3600), "hour");
  return rtf.format(Math.round(deltaSec / 86_400), "day");
}

function badgeLabel(count: number) {
  if (count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [busy, setBusy] = useState(false);

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
    try {
      const response = await fetch("/admin/notifications/inbox", {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const data = await response.json().catch(() => undefined);
      if (!response.ok) return;
      const list = Array.isArray(data?.items) ? (data.items as InboxItem[]) : [];
      setItems(list);
      await refreshCount();
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  }, [refreshCount]);

  useEffect(() => {
    void refreshCount();
    const id = window.setInterval(() => {
      void refreshCount();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    if (open) {
      void refreshList();
    }
  }, [open, refreshList]);

  async function markRead(id: string) {
    setBusy(true);
    try {
      await fetch("/admin/notifications/inbox", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "read", id }),
      });
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item,
        ),
      );
      setCount((current) => Math.max(0, current - 1));
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await fetch("/admin/notifications/inbox", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "read-all" }),
      });
      setItems((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
      setCount(0);
    } finally {
      setBusy(false);
    }
  }

  async function openItem(item: InboxItem) {
    if (!item.readAt) {
      await markRead(item.id);
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
          aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
          className="relative"
          size="icon"
          type="button"
          variant="ghost"
        >
          <AppIcons.notifications className="size-4" />
          {label ? (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {label}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-1.5rem,22rem)] gap-0 p-0">
        <PopoverHeader className="flex flex-row items-center justify-between gap-2 border-b px-3 py-2.5">
          <PopoverTitle className="text-sm font-semibold">Notifications</PopoverTitle>
          {count > 0 ? (
            <Button
              className="h-7 rounded-full px-2 text-xs"
              disabled={busy}
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => void markAllRead()}
            >
              Mark all read
            </Button>
          ) : null}
        </PopoverHeader>

        <div className="max-h-80 overflow-y-auto">
          {loadingList && items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : null}

          {!loadingList && items.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Order and payment updates for this shop will show up here.
              </p>
            </div>
          ) : null}

          <ul className="flex flex-col">
            {items.map((item) => {
              const unread = !item.readAt;
              return (
                <li key={item.id} className="border-b last:border-b-0">
                  <button
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                      unread && "bg-primary/5",
                    )}
                    disabled={busy}
                    type="button"
                    onClick={() => void openItem(item)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-snug">{item.title}</span>
                      {unread ? (
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    {item.body && item.body !== item.title ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
