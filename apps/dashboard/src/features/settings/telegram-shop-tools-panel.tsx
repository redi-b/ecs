"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NotificationChannelHeader,
  NotificationChannelUnavailable,
} from "@/features/settings/notification-channel-ui";
import type { TelegramOperatorBinding } from "@/lib/platform-api/notifications/telegram-client";
import { useI18n } from "@/i18n/provider";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { cn } from "@/lib/utils";

type LinkSession = {
  id: string;
  status: string;
  expiresAt: string;
  deepLink: string | null;
};

function apiError(data: unknown, fallback: string) {
  if (typeof data === "object" && data !== null) {
    const rec = data as { error?: unknown; message?: unknown };
    if (typeof rec.error === "string") return mapPlatformErrorMessage(rec.error);
    if (typeof rec.message === "string") return mapPlatformErrorMessage(rec.message);
  }
  return mapPlatformErrorMessage(fallback);
}

function formatLinkedAt(iso: string, locale: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Link a personal Telegram account for shop management (not alert delivery).
 */
export function TelegramShopToolsPanel({
  available,
  tenantId,
}: {
  available: boolean;
  tenantId: string;
}) {
  const { t, locale } = useI18n();
  const qs = useMemo(() => `tenantId=${encodeURIComponent(tenantId)}`, [tenantId]);
  const [bindings, setBindings] = useState<TelegramOperatorBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [linkSession, setLinkSession] = useState<LinkSession | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TelegramOperatorBinding | null>(null);

  const waiting = Boolean(linkSession && linkSession.status === "pending");

  const loadBindings = useCallback(async () => {
    if (!available) {
      setBindings([]);
      setLoadError(null);
      return;
    }
    const response = await fetch(`/admin/settings/notifications/telegram/operators?${qs}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json().catch(() => undefined);
    if (!response.ok) {
      setLoadError(apiError(data, "telegram_not_configured"));
      setBindings([]);
      return;
    }
    setLoadError(null);
    const list = Array.isArray(data?.bindings) ? (data.bindings as TelegramOperatorBinding[]) : [];
    setBindings(list);
  }, [available, qs]);

  useEffect(() => {
    setLoading(true);
    void loadBindings().finally(() => setLoading(false));
  }, [loadBindings]);

  useEffect(() => {
    if (!linkSession?.id || linkSession.status !== "pending") return;

    const id = window.setInterval(() => {
      void (async () => {
        const response = await fetch(
          `/admin/settings/notifications/telegram/operators?${qs}&sessionId=${encodeURIComponent(linkSession.id)}`,
          { headers: { accept: "application/json" }, cache: "no-store" },
        );
        const data = await response.json().catch(() => undefined);
        if (!response.ok) return;
        const next = data?.session as LinkSession | undefined;
        if (!next) return;
        setLinkSession(next);
        if (next.status === "consumed") {
          toast.success(t("settings.telegram.linked"));
          setLinkSession(null);
          await loadBindings();
        } else if (next.status === "expired" || next.status === "cancelled") {
          toast.message(t("settings.telegram.linkExpired"), {
            description: t("settings.telegram.linkExpiredDesc"),
          });
          setLinkSession(null);
        }
      })();
    }, 2500);

    return () => window.clearInterval(id);
  }, [linkSession, loadBindings, qs, t]);

  function postAction(body: Record<string, unknown>) {
    return fetch(`/admin/settings/notifications/telegram/operators?${qs}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  function refreshList() {
    setRefreshing(true);
    void loadBindings()
      .catch(() => toast.error(mapPlatformErrorMessage("platform_request_failed")))
      .finally(() => setRefreshing(false));
  }

  function startLink() {
    startTransition(async () => {
      try {
        const response = await postAction({ action: "link" });
        const data = await response.json().catch(() => undefined);
        if (!response.ok) {
          toast.error(apiError(data, "telegram_not_configured"));
          return;
        }
        const next = data?.session as (LinkSession & { deepLink: string }) | undefined;
        if (!next?.deepLink) {
          toast.error(t("settings.telegram.linkFailed"));
          return;
        }
        setLinkDialogOpen(false);
        setLinkSession(next);
        window.open(next.deepLink, "_blank", "noopener,noreferrer");
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  function cancelLink() {
    if (!linkSession) return;
    startTransition(async () => {
      await postAction({ action: "cancel", sessionId: linkSession.id });
      setLinkSession(null);
      toast.message(t("settings.telegram.linkCancelled"));
    });
  }

  function confirmRemove() {
    if (!removeTarget) return;
    const bindingId = removeTarget.id;
    startTransition(async () => {
      try {
        const response = await postAction({ action: "remove", bindingId });
        const data = await response.json().catch(() => undefined);
        if (!response.ok) {
          toast.error(apiError(data, "binding_not_found"));
          return;
        }
        toast.success(t("settings.telegram.unlinked"));
        setRemoveTarget(null);
        await loadBindings();
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  function setEnabled(bindingId: string, enabled: boolean) {
    startTransition(async () => {
      try {
        const response = await postAction({ action: "enable", bindingId, enabled });
        const data = await response.json().catch(() => undefined);
        if (!response.ok) {
          toast.error(apiError(data, "invalid_enabled"));
          return;
        }
        const binding = data?.binding as TelegramOperatorBinding | undefined;
        if (binding?.id) {
          setBindings((prev) => prev.map((row) => (row.id === bindingId ? binding : row)));
          toast.success(
            enabled ? t("settings.telegram.accessResumed") : t("settings.telegram.accessPaused"),
          );
        }
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  if (!available) {
    return (
      <Card>
        <NotificationChannelHeader
          description={t("settings.telegram.description")}
          disabled
          onRefresh={() => undefined}
          refreshing={false}
          title={t("settings.telegram.title")}
        />
        <CardContent>
          <NotificationChannelUnavailable
            description={t("settings.telegram.unavailable")}
            title={t("settings.telegram.unavailableTitle")}
          />
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <NotificationChannelHeader
          description={t("settings.telegram.description")}
          onRefresh={() => undefined}
          refreshing
          title={t("settings.telegram.title")}
        />
        <CardContent>
          <div className="h-28 animate-pulse rounded-lg bg-muted/50" />
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    const isNotConfigured =
      loadError.toLowerCase().includes("not available") ||
      loadError.toLowerCase().includes("not configured");
    if (isNotConfigured) {
      return (
        <Card>
          <NotificationChannelHeader
            description={t("settings.telegram.description")}
            disabled
            onRefresh={() => undefined}
            refreshing={false}
            title={t("settings.telegram.title")}
          />
          <CardContent>
            <NotificationChannelUnavailable
              description={t("settings.telegram.unavailable")}
              title={t("settings.telegram.unavailableTitle")}
            />
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <NotificationChannelHeader
          description={t("settings.telegram.description")}
          onRefresh={refreshList}
          refreshing={refreshing}
          title={t("settings.telegram.title")}
        />
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>{t("settings.telegram.loadErrorTitle")}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>{t("settings.telegram.loadErrorBody")}</span>
              <Button
                className="w-fit rounded-full"
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  void loadBindings().finally(() => setLoading(false));
                }}
              >
                {t("common.tryAgain")}
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <NotificationChannelHeader
          badge={
            bindings.length > 0 ? (
              <Badge variant="secondary" className="font-medium">
                {bindings.length === 1
                  ? t("settings.telegram.accountOne")
                  : t("settings.telegram.accountMany", { count: bindings.length })}
              </Badge>
            ) : null
          }
          description={t("settings.telegram.headerDescription")}
          disabled={isPending}
          onRefresh={refreshList}
          refreshLabel={t("settings.telegram.refresh")}
          refreshing={refreshing}
          title={t("settings.telegram.title")}
        />

        <CardContent className="flex flex-col gap-5">
          {waiting ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
                  <AppIcons.loader className="size-4 animate-spin text-primary" />
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.telegram.waitingTitle")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("settings.telegram.waitingBody")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {linkSession?.deepLink ? (
                      <Button
                        className="rounded-full"
                        size="sm"
                        type="button"
                        onClick={() =>
                          window.open(linkSession.deepLink!, "_blank", "noopener,noreferrer")
                        }
                      >
                        {t("settings.telegram.openTelegram")}
                        <AppIcons.externalLink className="size-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      className="rounded-full"
                      disabled={isPending}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={cancelLink}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border bg-muted/20 px-4 py-3">
            <p className="text-sm font-medium text-foreground">{t("settings.telegram.howTitle")}</p>
            <ol className="mt-2 list-decimal space-y-1.5 ps-4 text-sm text-muted-foreground">
              <li>{t("settings.telegram.step1")}</li>
              <li>{t("settings.telegram.step2")}</li>
              <li>{t("settings.telegram.step3")}</li>
            </ol>
          </div>

          {bindings.length === 0 && !waiting ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center">
              <p className="text-sm font-medium">{t("settings.telegram.emptyTitle")}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {t("settings.telegram.emptyBody")}
              </p>
              <Button
                className="mt-4 rounded-full"
                disabled={isPending}
                size="sm"
                type="button"
                onClick={() => setLinkDialogOpen(true)}
              >
                {t("settings.telegram.link")}
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {bindings.map((binding) => {
                const linkedAt = formatLinkedAt(binding.linkedAt, locale);
                return (
                  <li
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between",
                      !binding.enabled && "opacity-80",
                    )}
                    key={binding.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">{binding.label}</span>
                        <Badge variant={binding.enabled ? "secondary" : "outline"}>
                          {binding.enabled
                            ? t("settings.telegram.enabled")
                            : t("settings.telegram.disabled")}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {binding.username ? <span>@{binding.username}</span> : null}
                        {linkedAt ? (
                          <span>
                            {t("settings.telegram.linkedAt")} {linkedAt}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="rounded-full"
                        disabled={isPending}
                        onClick={() => setEnabled(binding.id, !binding.enabled)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {binding.enabled
                          ? t("settings.telegram.disable")
                          : t("settings.telegram.enable")}
                      </Button>
                      <Button
                        className="rounded-full"
                        disabled={isPending}
                        onClick={() => setRemoveTarget(binding)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {t("settings.telegram.remove")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {bindings.length > 0 || waiting ? (
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-full"
                disabled={isPending || waiting}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => setLinkDialogOpen(true)}
              >
                {t("settings.telegram.linkAnother")}
              </Button>
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("settings.telegram.alertsNote")}
          </p>
        </CardContent>
      </Card>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.telegram.linkDialogTitle")}</DialogTitle>
            <DialogDescription>{t("settings.telegram.linkDialogDescription")}</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 ps-4 text-sm text-muted-foreground">
            <li>{t("settings.telegram.step1")}</li>
            <li>{t("settings.telegram.step2")}</li>
            <li>{t("settings.telegram.step3")}</li>
          </ol>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button className="rounded-full" type="button" variant="outline">
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <Button
              className="rounded-full"
              disabled={isPending}
              type="button"
              onClick={startLink}
            >
              {isPending ? t("settings.telegram.opening") : t("settings.telegram.continueTelegram")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.telegram.removeTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.telegram.removeDescription", {
                name: removeTarget?.label ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button className="rounded-full" type="button" variant="outline">
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <Button
              className="rounded-full"
              disabled={isPending}
              type="button"
              variant="destructive"
              onClick={confirmRemove}
            >
              {t("settings.telegram.remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
