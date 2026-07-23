"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildNotificationEventsPayload,
  defaultNotificationEvents,
  normalizeNotificationEvents,
  NotificationAccountCountBadge,
  NotificationAlertsSwitch,
  NotificationChannelHeader,
  NotificationChannelUnavailable,
  NotificationEventPicker,
  sameNotificationEvents,
} from "@/features/settings/notification-channel-ui";
import {
  apiError,
  connectSteps,
  type ConnectSession,
} from "@/features/settings/telegram-connect-helpers";
import { DestinationIdentity } from "@/features/settings/telegram-connect-parts";
import type { TelegramDestination } from "@/lib/platform-api/notifications/telegram-client";
import { useI18n } from "@/i18n/provider";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { cn } from "@/lib/utils";

export function TelegramConnectPanel({
  available = true,
  tenantId,
}: {
  available?: boolean;
  tenantId: string;
}) {
  const { t } = useI18n();
  const [destinations, setDestinations] = useState<TelegramDestination[]>([]);
  const [savedEvents, setSavedEvents] = useState<string[]>(defaultNotificationEvents());
  const [eventsDraft, setEventsDraft] = useState<string[]>(defaultNotificationEvents());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingEvents, setSavingEvents] = useState(false);
  const [session, setSession] = useState<ConnectSession | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TelegramDestination | null>(null);
  const [isPending, startTransition] = useTransition();

  const qs = `tenantId=${encodeURIComponent(tenantId)}`;
  const waiting = session?.status === "pending";
  const hasAccounts = destinations.length > 0;
  const eventsDirty = !sameNotificationEvents(eventsDraft, savedEvents);

  const loadDestinations = useCallback(async () => {
    const response = await fetch(`/admin/settings/notifications/telegram?${qs}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json().catch(() => undefined);
    if (!response.ok) {
      setLoadError(apiError(data, "telegram_not_configured"));
      return;
    }
    setLoadError(null);
    const list = Array.isArray(data?.destinations)
      ? (data.destinations as TelegramDestination[])
      : [];
    setDestinations(list);
    if (list[0]?.events?.length) {
      const next = normalizeNotificationEvents(list[0].events);
      setSavedEvents(next);
      setEventsDraft(next);
    }
  }, [qs]);

  useEffect(() => {
    if (!available) {
      setLoading(false);
      setLoadError(null);
      setDestinations([]);
      return;
    }
    setLoading(true);
    void loadDestinations().finally(() => setLoading(false));
  }, [available, loadDestinations]);

  useEffect(() => {
    if (!session || session.status !== "pending") {
      return;
    }
    const id = window.setInterval(() => {
      void (async () => {
        const response = await fetch(
          `/admin/settings/notifications/telegram?${qs}&sessionId=${encodeURIComponent(session.id)}`,
          { headers: { accept: "application/json" }, cache: "no-store" },
        );
        const data = await response.json().catch(() => undefined);
        if (!response.ok) {
          return;
        }
        const next = data?.session as ConnectSession | undefined;
        if (!next) {
          return;
        }
        setSession(next);
        if (next.status === "consumed") {
          toast.success(t("settings.notifications.telegramPanel.connected"));
          setSession(null);
          await loadDestinations();
        }
      })();
    }, 2500);
    return () => window.clearInterval(id);
  }, [session, qs, loadDestinations]);

  function postAction(body: Record<string, unknown>) {
    return fetch(`/admin/settings/notifications/telegram?${qs}`, {
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
    void loadDestinations()
      .catch(() => {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      })
      .finally(() => setRefreshing(false));
  }

  function startConnect() {
    startTransition(async () => {
      try {
        const response = await postAction({ action: "connect" });
        const data = await response.json().catch(() => undefined);
        if (!response.ok) {
          toast.error(apiError(data, "telegram_not_configured"));
          return;
        }
        const next = data?.session as (ConnectSession & { deepLink: string }) | undefined;
        if (!next?.deepLink) {
          toast.error(t("settings.notifications.telegramPanel.connectFailed"));
          return;
        }
        setConnectDialogOpen(false);
        setSession(next);
        window.open(next.deepLink, "_blank", "noopener,noreferrer");
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  function refreshSession() {
    if (!session) {
      refreshList();
      return;
    }
    startTransition(async () => {
      const response = await fetch(
        `/admin/settings/notifications/telegram?${qs}&sessionId=${encodeURIComponent(session.id)}`,
        { headers: { accept: "application/json" }, cache: "no-store" },
      );
      const data = await response.json().catch(() => undefined);
      if (!response.ok) {
        toast.error(apiError(data, "session_not_found"));
        return;
      }
      const next = data?.session as ConnectSession | undefined;
      if (!next) {
        return;
      }
      setSession(next);
      if (next.status === "consumed") {
        toast.success(t("settings.notifications.telegramPanel.connected"));
        setSession(null);
        await loadDestinations();
      } else if (next.status === "expired" || next.status === "cancelled") {
        toast.message(t("settings.notifications.telegramPanel.linkExpired"), {
          description: t("settings.notifications.telegramPanel.linkExpiredDesc"),
        });
        setSession(null);
      } else {
        toast.message(t("settings.notifications.telegramPanel.stillWaiting"), {
          description: t("settings.notifications.telegramPanel.stillWaitingDesc"),
        });
      }
    });
  }

  function cancelSession() {
    if (!session) {
      return;
    }
    startTransition(async () => {
      await postAction({ action: "cancel", sessionId: session.id });
      setSession(null);
      toast.message(t("settings.notifications.telegramPanel.connectCancelled"));
    });
  }

  function confirmRemove() {
    if (!removeTarget) {
      return;
    }
    const destinationId = removeTarget.id;
    startTransition(async () => {
      const response = await postAction({ action: "remove", destinationId });
      const data = await response.json().catch(() => undefined);
      if (!response.ok) {
        toast.error(apiError(data, "destination_not_found"));
        return;
      }
      toast.success(t("settings.notifications.telegramPanel.disconnected"));
      setRemoveTarget(null);
      await loadDestinations();
    });
  }

  function toggleEnabled(destinationId: string, enabled: boolean) {
    startTransition(async () => {
      const response = await postAction({ action: "enable", destinationId, enabled });
      const data = await response.json().catch(() => undefined);
      if (!response.ok) {
        toast.error(apiError(data, "destination_not_found"));
        return;
      }
      toast.success(enabled ? t("settings.notifications.telegramPanel.alertsResumed") : t("settings.notifications.telegramPanel.alertsPaused"));
      await loadDestinations();
    });
  }

  function saveEvents() {
    setSavingEvents(true);
    startTransition(async () => {
      try {
        const response = await postAction({
          action: "events",
          events: buildNotificationEventsPayload(eventsDraft),
        });
        const data = await response.json().catch(() => undefined);
        if (!response.ok) {
          toast.error(apiError(data, "notification_events_invalid"));
          return;
        }
        toast.success(t("settings.notifications.telegramPanel.eventsSaved"));
        await loadDestinations();
      } finally {
        setSavingEvents(false);
      }
    });
  }

  function sendTest(destinationId: string) {
    startTransition(async () => {
      const response = await postAction({ action: "test", destinationId });
      const data = await response.json().catch(() => undefined);
      if (!response.ok) {
        toast.error(apiError(data, "notification_preference_missing"));
        return;
      }
      toast.success(
        data?.jobEnqueued
          ? t("settings.notifications.telegramPanel.testSent")
          : t("settings.notifications.telegramPanel.testRequested"),
      );
    });
  }

  async function copyDeepLink() {
    if (!session?.deepLink) return;
    try {
      await navigator.clipboard.writeText(session.deepLink);
      toast.success(t("settings.notifications.telegramPanel.linkCopied"));
    } catch {
      toast.error(t("settings.notifications.telegramPanel.copyFailed"));
    }
  }

  if (!available) {
    return (
      <Card size="sm">
        <NotificationChannelHeader
          description={t("settings.notifications.telegramPanel.description")}
          disabled
          onRefresh={() => undefined}
          refreshing={false}
          title={t("settings.notifications.telegram")}
        />
        <CardContent className="pt-3">
          <NotificationChannelUnavailable
            description={t("settings.notifications.telegramPanel.unavailableDescription")}
            title={t("settings.notifications.telegramPanel.unavailableTitle")}
          />
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card size="sm">
        <NotificationChannelHeader
          description={t("settings.notifications.loadingTelegram")}
          onRefresh={() => undefined}
          refreshing
          title={t("settings.notifications.telegram")}
        />
        <CardContent className="pt-3">
          <div className="h-24 animate-pulse rounded-lg bg-muted/50" />
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
        <Card size="sm">
          <NotificationChannelHeader
            description={t("settings.notifications.telegramPanel.description")}
            disabled
            onRefresh={() => undefined}
            refreshing={false}
            title={t("settings.notifications.telegram")}
          />
          <CardContent className="pt-3">
            <NotificationChannelUnavailable
              description={t("settings.notifications.telegramPanel.unavailableDescription")}
              title={t("settings.notifications.telegramPanel.unavailableTitle")}
            />
          </CardContent>
        </Card>
      );
    }
    return (
      <Card size="sm">
        <NotificationChannelHeader
          description={t("settings.notifications.telegramPanel.description")}
          onRefresh={refreshList}
          refreshing={refreshing}
          title={t("settings.notifications.telegram")}
        />
        <CardContent className="pt-3">
          <Alert variant="destructive">
            <AlertTitle>Couldn’t load Telegram</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>Something went wrong loading connected accounts. Try again.</span>
              <Button
                className="w-fit rounded-full"
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  void loadDestinations().finally(() => setLoading(false));
                }}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card size="sm">
        <NotificationChannelHeader
          badge={<NotificationAccountCountBadge count={destinations.length} />}
          description={t("settings.notifications.telegramPanel.headerDescription")}
          disabled={isPending}
          onRefresh={refreshList}
          refreshLabel={t("settings.notifications.telegramPanel.refreshAccounts")}
          refreshing={refreshing}
          title={t("settings.notifications.telegram")}
        />

        <CardContent className="flex flex-col gap-4 pt-3">
          {waiting ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
                  <AppIcons.loader className="size-4 animate-spin text-primary" />
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">Waiting for Telegram</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Open the bot chat and tap <strong className="text-foreground">Start</strong>.
                      This page checks for you every few seconds.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {session?.deepLink ? (
                      <Button
                        className="rounded-full"
                        size="sm"
                        type="button"
                        onClick={() =>
                          window.open(session.deepLink!, "_blank", "noopener,noreferrer")
                        }
                      >
                        Open Telegram
                        <AppIcons.externalLink className="size-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      className="rounded-full"
                      disabled={isPending}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={refreshSession}
                    >
                      Check status
                    </Button>
                    {session?.deepLink ? (
                      <Button
                        className="rounded-full"
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => void copyDeepLink()}
                      >
                        <AppIcons.copy className="size-3.5" />
                        Copy link
                      </Button>
                    ) : null}
                    <Button
                      className="rounded-full"
                      disabled={isPending}
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={cancelSession}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!hasAccounts && !waiting ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center">
              <div className="flex size-11 items-center justify-center rounded-full border bg-background shadow-sm">
                <AppIcons.notifications className="size-5 text-muted-foreground" />
              </div>
              <div className="max-w-sm space-y-1">
                <p className="text-sm font-medium text-foreground">No accounts connected</p>
                <p className="text-sm text-muted-foreground">
                  Link a Telegram account to get alerts for orders, payments, and more.
                </p>
              </div>
              <Button
                className="rounded-full"
                disabled={isPending}
                type="button"
                onClick={() => setConnectDialogOpen(true)}
              >
                Connect Telegram
              </Button>
            </div>
          ) : null}

          {hasAccounts ? (
            <ul className="flex flex-col gap-2">
              {destinations.map((destination) => (
                <li
                  key={destination.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between",
                    !destination.enabled && "bg-muted/20 opacity-90",
                  )}
                >
                  <DestinationIdentity destination={destination} />
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    <NotificationAlertsSwitch
                      checked={destination.enabled}
                      disabled={isPending}
                      onCheckedChange={(checked) => toggleEnabled(destination.id, checked)}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label={t("settings.notifications.telegramPanel.sendTestAria")}
                          className="rounded-full"
                          disabled={isPending || !destination.enabled}
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => sendTest(destination.id)}
                        >
                          Send test
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Send a test alert to this account</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label={`Disconnect ${destination.label}`}
                          className="rounded-full"
                          disabled={isPending}
                          size="icon-sm"
                          type="button"
                          variant="destructive"
                          onClick={() => setRemoveTarget(destination)}
                        >
                          <AppIcons.trash />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Disconnect</TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {hasAccounts || waiting ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="rounded-full"
                disabled={isPending || waiting}
                type="button"
                variant={hasAccounts ? "outline" : "default"}
                onClick={() => setConnectDialogOpen(true)}
              >
                {hasAccounts ? t("settings.notifications.telegramPanel.connectAnother") : t("settings.notifications.telegramPanel.connectTelegram")}
              </Button>
            </div>
          ) : null}

          {hasAccounts ? (
            <NotificationEventPicker
              description={t("settings.notifications.telegramPanel.eventsShared")}
              dirty={eventsDirty}
              disabled={isPending}
              events={eventsDraft}
              saving={savingEvents}
              onChange={setEventsDraft}
              onSave={saveEvents}
            />
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasAccounts ? t("settings.notifications.telegramPanel.connectAnotherTelegram") : t("settings.notifications.telegramPanel.connectTelegram")}
            </DialogTitle>
            <DialogDescription>
              You’ll leave this page briefly to authorize alerts in Telegram.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 py-1">
            {connectSteps(t).map((step, index) => (
              <li className="flex gap-3 text-sm" key={step}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Use the Telegram account that should receive shop alerts. You can connect more later.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button className="rounded-full" type="button" variant="outline">
                Not now
              </Button>
            </DialogClose>
            <Button
              className="rounded-full"
              disabled={isPending}
              type="button"
              onClick={startConnect}
            >
              {isPending ? t("settings.notifications.telegramPanel.opening") : t("settings.notifications.telegramPanel.continueTelegram")}
              {!isPending ? <AppIcons.externalLink className="size-3.5" /> : null}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Telegram?</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `${removeTarget.label} will stop receiving shop event alerts. You can connect again anytime.`
                : t("settings.notifications.telegramPanel.disconnectDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button className="rounded-full" type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              className="rounded-full"
              disabled={isPending}
              type="button"
              variant="destructive"
              onClick={confirmRemove}
            >
              {isPending ? t("settings.notifications.telegramPanel.disconnecting") : t("settings.notifications.telegramPanel.disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
