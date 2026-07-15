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
  NotificationEventPicker,
  sameNotificationEvents,
} from "@/features/settings/notification-channel-ui";
import type { TelegramDestination } from "@/lib/platform-api/notifications/telegram-client";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { cn } from "@/lib/utils";

const CONNECT_STEPS = [
  "We’ll open Telegram with a one-time link for this shop.",
  "Tap Start in the chat so we can send alerts there.",
  "Come back here — the account appears when connect succeeds.",
] as const;

type ConnectSession = {
  id: string;
  status: string;
  expiresAt: string;
  deepLink: string | null;
};

function apiError(data: unknown, fallback: string) {
  if (typeof data === "object" && data !== null) {
    const rec = data as { error?: unknown; message?: unknown };
    if (typeof rec.error === "string") {
      return mapPlatformErrorMessage(rec.error);
    }
    if (typeof rec.message === "string") {
      return mapPlatformErrorMessage(rec.message);
    }
  }
  return mapPlatformErrorMessage(fallback);
}

function telegramProfileUrl(username: string) {
  const clean = username.replace(/^@/, "").trim();
  if (!clean) return null;
  return `https://t.me/${encodeURIComponent(clean)}`;
}

function formatConnectedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Connected recently";
  return `Connected ${date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function DestinationIdentity({ destination }: { destination: TelegramDestination }) {
  const username = destination.username?.replace(/^@/, "").trim() || null;
  const profileUrl = username ? telegramProfileUrl(username) : null;
  const showUsernameBesideLabel =
    username !== null &&
    destination.label.replace(/^@/, "").toLowerCase() !== username.toLowerCase();

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {profileUrl && !showUsernameBesideLabel ? (
          <a
            className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-foreground underline-offset-4 hover:underline"
            href={profileUrl}
            rel="noreferrer"
            target="_blank"
          >
            <span className="truncate">{destination.label}</span>
            <AppIcons.externalLink className="size-3 shrink-0 opacity-60" />
          </a>
        ) : (
          <p className="truncate text-sm font-semibold">{destination.label}</p>
        )}
        {profileUrl && showUsernameBesideLabel ? (
          <a
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href={profileUrl}
            rel="noreferrer"
            target="_blank"
          >
            @{username}
            <AppIcons.externalLink className="size-3 shrink-0 opacity-60" />
          </a>
        ) : null}
        <Badge variant={destination.enabled ? "secondary" : "outline"}>
          {destination.enabled ? "Active" : "Paused"}
        </Badge>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatConnectedAt(destination.connectedAt)}
      </p>
    </div>
  );
}

export function TelegramConnectPanel({ tenantId }: { tenantId: string }) {
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
    setLoading(true);
    void loadDestinations().finally(() => setLoading(false));
  }, [loadDestinations]);

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
          toast.success("Telegram connected");
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
          toast.error("Could not start Telegram connect. Try again.");
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
        toast.success("Telegram connected");
        setSession(null);
        await loadDestinations();
      } else if (next.status === "expired" || next.status === "cancelled") {
        toast.message("Link expired", {
          description: "Start connect again for a new link.",
        });
        setSession(null);
      } else {
        toast.message("Still waiting", {
          description: "Open Telegram, tap Start, then check again.",
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
      toast.message("Connect cancelled");
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
      toast.success("Telegram account disconnected");
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
      toast.success(enabled ? "Alerts resumed" : "Alerts paused");
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
        toast.success("Event preferences saved");
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
        data?.jobEnqueued ? "Test sent — check Telegram." : "Test message requested.",
      );
    });
  }

  async function copyDeepLink() {
    if (!session?.deepLink) return;
    try {
      await navigator.clipboard.writeText(session.deepLink);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  if (loading) {
    return (
      <Card>
        <NotificationChannelHeader
          description="Loading connected accounts…"
          onRefresh={() => undefined}
          refreshing
          title="Telegram"
        />
        <CardContent>
          <div className="h-24 animate-pulse rounded-lg bg-muted/50" />
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Telegram unavailable</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>
            {loadError} Try again in a moment. If this keeps happening, contact support.
          </span>
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
    );
  }

  return (
    <>
      <Card>
        <NotificationChannelHeader
          badge={<NotificationAccountCountBadge count={destinations.length} />}
          description="Instant shop event alerts on Telegram. Connect staff phones as needed."
          disabled={isPending}
          onRefresh={refreshList}
          refreshLabel="Refresh accounts"
          refreshing={refreshing}
          title="Telegram"
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
                          aria-label="Send test message"
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
                {hasAccounts ? "Connect another account" : "Connect Telegram"}
              </Button>
            </div>
          ) : null}

          {hasAccounts ? (
            <NotificationEventPicker
              description="Same events for every connected Telegram account."
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
              {hasAccounts ? "Connect another Telegram account" : "Connect Telegram"}
            </DialogTitle>
            <DialogDescription>
              You’ll leave this page briefly to authorize alerts in Telegram.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 py-1">
            {CONNECT_STEPS.map((step, index) => (
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
              {isPending ? "Opening…" : "Continue to Telegram"}
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
                : "This account will stop receiving shop event alerts."}
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
              {isPending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
