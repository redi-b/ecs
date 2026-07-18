"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NotificationChannelHeader,
  NotificationChannelUnavailable,
} from "@/features/settings/notification-channel-ui";
import type { TelegramOperatorBinding } from "@/lib/platform-api/notifications/telegram-client";
import { useI18n } from "@/i18n/provider";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";

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

/**
 * Links a Telegram account to the signed-in merchant for shop tools (writes).
 * Separate from notification destinations (alert delivery).
 */
export function TelegramShopToolsPanel({
  available,
  tenantId,
}: {
  available: boolean;
  tenantId: string;
}) {
  const { t } = useI18n();
  const qs = useMemo(() => `tenantId=${encodeURIComponent(tenantId)}`, [tenantId]);
  const [bindings, setBindings] = useState<TelegramOperatorBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [linkSession, setLinkSession] = useState<LinkSession | null>(null);

  const loadBindings = useCallback(async () => {
    if (!available) {
      setBindings([]);
      return;
    }
    const response = await fetch(`/admin/settings/notifications/telegram/operators?${qs}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json().catch(() => undefined);
    if (!response.ok) {
      toast.error(apiError(data, "telegram_not_configured"));
      setBindings([]);
      return;
    }
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
          toast.success(t("settings.notifications.shopTools.linked"));
          setLinkSession(null);
          await loadBindings();
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
          toast.error(t("settings.notifications.shopTools.linkFailed"));
          return;
        }
        setLinkSession(next);
        window.open(next.deepLink, "_blank", "noopener,noreferrer");
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  function removeBinding(bindingId: string) {
    startTransition(async () => {
      try {
        const response = await postAction({ action: "remove", bindingId });
        const data = await response.json().catch(() => undefined);
        if (!response.ok) {
          toast.error(apiError(data, "binding_not_found"));
          return;
        }
        toast.success(t("settings.notifications.shopTools.unlinked"));
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
        }
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  return (
    <Card>
      <NotificationChannelHeader
        description={t("settings.notifications.shopTools.description")}
        disabled={!available || isPending}
        onRefresh={refreshList}
        refreshLabel={t("common.refresh")}
        refreshing={refreshing || loading}
        title={t("settings.notifications.shopTools.title")}
      />
      <CardContent className="flex flex-col gap-4">
        {!available ? (
          <NotificationChannelUnavailable
            description={t("settings.notifications.shopTools.unavailable")}
            title={t("settings.notifications.shopTools.unavailableTitle")}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("settings.notifications.shopTools.intro")}
            </p>

            {loading ? (
              <div className="h-16 animate-pulse rounded-lg bg-muted/50" />
            ) : bindings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.shopTools.empty")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {bindings.map((binding) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5"
                    key={binding.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{binding.label}</span>
                        <Badge variant={binding.enabled ? "secondary" : "outline"}>
                          {binding.enabled
                            ? t("settings.notifications.shopTools.enabled")
                            : t("settings.notifications.shopTools.disabled")}
                        </Badge>
                      </div>
                      {binding.username ? (
                        <p className="text-xs text-muted-foreground">@{binding.username}</p>
                      ) : null}
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
                          ? t("settings.notifications.shopTools.disable")
                          : t("settings.notifications.shopTools.enable")}
                      </Button>
                      <Button
                        className="rounded-full"
                        disabled={isPending}
                        onClick={() => removeBinding(binding.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {t("settings.notifications.shopTools.remove")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="rounded-full"
                disabled={isPending}
                onClick={startLink}
                size="sm"
                type="button"
              >
                {linkSession?.status === "pending"
                  ? t("settings.notifications.shopTools.waiting")
                  : t("settings.notifications.shopTools.link")}
              </Button>
              {linkSession?.deepLink ? (
                <Button asChild className="rounded-full" size="sm" variant="outline">
                  <a href={linkSession.deepLink} rel="noreferrer" target="_blank">
                    {t("settings.notifications.shopTools.openBot")}
                  </a>
                </Button>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
