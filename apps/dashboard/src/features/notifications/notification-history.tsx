"use client";

import { Archive, Check, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { DataTableFilters } from "@/components/app/data-table-filters";
import { AppIcons } from "@/components/app/icons";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import { notifyInboxChanged } from "@/lib/notification-sync";
import type { InAppNotificationItem } from "@/lib/platform-api/notifications/inbox-client";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type Category = InAppNotificationItem["category"] | "all";
type InitialResult =
  | { ok: true; count: number; items: InAppNotificationItem[]; nextCursor: string | null }
  | { ok: false; message: string; status: number };

export function NotificationHistory({
  category,
  initialResult,
  query,
  unreadOnly,
}: {
  category: Category;
  initialResult: InitialResult;
  query: string;
  unreadOnly: boolean;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState(initialResult.ok ? initialResult.items : []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  const groups = useMemo(() => groupByDate(items, locale), [items, locale]);

  useEffect(() => {
    setItems(initialResult.ok ? initialResult.items : []);
  }, [initialResult]);

  function navigate(next: { category?: Category; query?: string; unreadOnly?: boolean }) {
    const params = new URLSearchParams();
    const nextCategory = next.category ?? category;
    const nextUnread = next.unreadOnly ?? unreadOnly;
    const nextQuery = next.query ?? query;
    if (nextCategory !== "all") params.set("category", nextCategory);
    if (nextUnread) params.set("view", "unread");
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    startNavigation(() => {
      router.replace(`${dashboardRoutes.notifications}${params.size ? `?${params}` : ""}`, {
        scroll: false,
      });
    });
  }

  async function mutate(id: string, action: "archive" | "read" | "unread") {
    setBusyId(id);
    try {
      const response = await fetch("/dashboard/notifications/inbox", {
        body: JSON.stringify({ action, id }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error();
      if (action === "archive" || (action === "read" && unreadOnly)) {
        setItems((current) => current.filter((item) => item.id !== id));
      } else {
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, readAt: action === "read" ? new Date().toISOString() : null }
              : item,
          ),
        );
      }
      notifyInboxChanged();
    } catch {
      toast.error(t("common.inbox.updateError"));
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setBusyId("all");
    try {
      const response = await fetch("/dashboard/notifications/inbox", {
        body: JSON.stringify({ action: "read-all" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error();
      if (unreadOnly) setItems([]);
      else {
        const readAt = new Date().toISOString();
        setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      }
      notifyInboxChanged();
    } catch {
      toast.error(t("common.inbox.updateError"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      aria-busy={isNavigating || undefined}
      className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
    >
      <div className="border-b border-border/70 bg-muted/15 px-3 py-3 sm:px-4">
        <DataTableFilters
          actions={
            <Button
              disabled={busyId === "all" || !items.some((item) => !item.readAt)}
              onClick={() => void markAllRead()}
              size="sm"
              variant="outline"
            >
              {busyId === "all" ? <AppIcons.loader className="animate-spin" /> : <Check />}
              {t("common.inbox.markAllRead")}
            </Button>
          }
          filters={[
            {
              defaultValue: "all",
              id: "category",
              label: t("common.inbox.category"),
              onChange: (value) => navigate({ category: value as Category }),
              options: (["orders", "inventory", "inquiries", "billing", "system"] as const).map(
                (value) => ({ label: t(`common.inbox.categories.${value}`), value }),
              ),
              value: category,
            },
          ]}
          onClearAll={() => navigate({ category: "all" })}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <ListToolbarSearch
              clearLabel={t("common.clearSearch")}
              label={t("common.inbox.searchLabel")}
              onChange={(value) => navigate({ query: value })}
              placeholder={t("common.inbox.searchPlaceholder")}
              value={query}
            />
            <SegmentedControl
              active="muted"
              ariaLabel={t("common.inbox.view")}
              className="h-8 w-fit shrink-0 [&_button]:min-w-[4.75rem] [&_button]:px-3"
              fullWidth={false}
              onChange={(value) => navigate({ unreadOnly: value === "unread" })}
              options={[
                { id: "all", label: t("common.inbox.all") },
                { id: "unread", label: t("common.inbox.unreadFilter") },
              ]}
              size="sm"
              value={unreadOnly ? "unread" : "all"}
            />
          </div>
        </DataTableFilters>
      </div>

      {!initialResult.ok ? (
        <div className="px-5 py-14 text-center">
          <p className="text-sm font-medium">{t("common.inbox.loadErrorTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("common.inbox.loadErrorDesc")}</p>
          <Button className="mt-4" onClick={() => router.refresh()} variant="outline">
            {t("common.tryAgain")}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-16 text-center">
          <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
            <AppIcons.notifications className="size-4 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium">{t("common.inbox.emptyTitle")}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t("common.inbox.emptyHistoryDesc")}
          </p>
        </div>
      ) : (
        <div>
          {groups.map((group) => (
            <div key={group.label}>
              <div className="border-b border-border/70 bg-muted/20 px-4 py-2 text-xs font-medium text-muted-foreground sm:px-5">
                {group.label}
              </div>
              <ul className="divide-y">
                {group.items.map((item) => {
                  const unread = !item.readAt;
                  return (
                    <li
                      className={cn(
                        "group flex gap-3 px-4 py-4 transition-colors hover:bg-muted/25 sm:px-5",
                        unread && "bg-primary/[0.025]",
                      )}
                      key={item.id}
                    >
                      <span
                        className={cn(
                          "mt-0.5 size-2 shrink-0 rounded-full",
                          unread ? "bg-primary" : "bg-transparent",
                        )}
                      />
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          if (unread) void mutate(item.id, "read");
                          if (item.href?.startsWith("/dashboard")) router.push(item.href);
                        }}
                        type="button"
                      >
                        <span className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>
                            {item.title}
                          </span>
                          {item.occurrenceCount > 1 ? (
                            <Badge className="text-[10px]" variant="secondary">
                              {t("common.inbox.occurrences", { count: item.occurrenceCount })}
                            </Badge>
                          ) : null}
                          <time className="text-xs text-muted-foreground">
                            {formatTime(item.createdAt, locale)}
                          </time>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-sm leading-6 text-muted-foreground">
                          {item.body}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-start gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              aria-label={
                                unread
                                  ? t("common.inbox.markAsRead")
                                  : t("common.inbox.markAsUnread")
                              }
                              disabled={busyId === item.id}
                              onClick={() => void mutate(item.id, unread ? "read" : "unread")}
                              size="icon-sm"
                              variant="ghost"
                            >
                              {unread ? <Check /> : <Circle />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {unread ? t("common.inbox.markAsRead") : t("common.inbox.markAsUnread")}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              aria-label={t("common.inbox.archive")}
                              disabled={busyId === item.id}
                              onClick={() => void mutate(item.id, "archive")}
                              size="icon-sm"
                              variant="ghost"
                            >
                              <Archive />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("common.inbox.archive")}</TooltipContent>
                        </Tooltip>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function groupByDate(items: InAppNotificationItem[], locale: string) {
  const groups = new Map<string, InAppNotificationItem[]>();
  for (const item of items) {
    const date = new Date(item.createdAt);
    const key = date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups].map(([label, groupedItems]) => ({ items: groupedItems, label }));
}

function formatTime(value: string, locale: string) {
  return new Date(value).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}
