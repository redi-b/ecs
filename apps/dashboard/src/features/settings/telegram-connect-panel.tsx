"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { TelegramDestination } from "@/lib/platform-api/notifications/telegram-client";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { cn } from "@/lib/utils";

const EVENT_OPTIONS = [
  { id: "order.created", label: "New orders" },
  { id: "order.cancelled", label: "Cancelled orders" },
  { id: "payment.paid", label: "Payments received" },
  { id: "payment.failed", label: "Payment failures" },
  { id: "cod_order.created", label: "COD orders" },
] as const;

const ALWAYS_ON = ["notification.test"] as const;

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

export function TelegramConnectPanel({ tenantId }: { tenantId: string }) {
  const [destinations, setDestinations] = useState<TelegramDestination[]>([]);
  const [events, setEvents] = useState<string[]>(EVENT_OPTIONS.map((e) => e.id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ConnectSession | null>(null);
  const [isPending, startTransition] = useTransition();

  const qs = `tenantId=${encodeURIComponent(tenantId)}`;

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
      const selected = EVENT_OPTIONS.map((e) => e.id).filter(
        (id) => list[0]!.events.includes(id) || list[0]!.events.includes("*"),
      );
      if (selected.length > 0) {
        setEvents(selected);
      }
    }
  }, [qs]);

  useEffect(() => {
    setLoading(true);
    void loadDestinations().finally(() => setLoading(false));
  }, [loadDestinations]);

  // Poll while connect session is pending.
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
          toast.error("Could not create connect link");
          return;
        }
        setSession(next);
        window.open(next.deepLink, "_blank", "noopener,noreferrer");
        toast.message("Finish in Telegram", {
          description: "Tap Start in the bot, then use Refresh if this page does not update.",
        });
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  function refreshSession() {
    if (!session) {
      void loadDestinations();
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
        toast.message("Connect link expired", {
          description: "Tap Connect Telegram to try again.",
        });
        setSession(null);
      } else {
        toast.message("Still waiting", {
          description: "Open the bot and tap Start, then refresh again.",
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

  function removeDestination(destinationId: string) {
    startTransition(async () => {
      const response = await postAction({ action: "remove", destinationId });
      const data = await response.json().catch(() => undefined);
      if (!response.ok) {
        toast.error(apiError(data, "destination_not_found"));
        return;
      }
      toast.success("Telegram account removed");
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
      await loadDestinations();
    });
  }

  function saveEvents() {
    startTransition(async () => {
      const response = await postAction({
        action: "events",
        events: [...new Set([...events, ...ALWAYS_ON])],
      });
      const data = await response.json().catch(() => undefined);
      if (!response.ok) {
        toast.error(apiError(data, "notification_events_invalid"));
        return;
      }
      toast.success("Telegram event preferences saved");
      await loadDestinations();
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
          ? "Test message queued — check Telegram."
          : "Test created. Ensure the platform worker is running.",
      );
    });
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Telegram</CardTitle>
          <CardDescription>Loading connections…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Telegram unavailable</AlertTitle>
        <AlertDescription>
          {loadError} Set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME on platform-api to enable
          connect.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Telegram</CardTitle>
        <CardDescription>
          Connect one or more Telegram accounts. No chat ID required — open the bot and tap Start.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {session?.status === "pending" ? (
          <Alert>
            <AlertTitle>Waiting for Telegram</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>
                Open the bot and tap <strong>Start</strong>. This page checks every few seconds.
              </span>
              <div className="flex flex-wrap gap-2">
                {session.deepLink ? (
                  <Button
                    className="rounded-full"
                    size="sm"
                    type="button"
                    onClick={() => window.open(session.deepLink!, "_blank", "noopener,noreferrer")}
                  >
                    Open bot again
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
                  Refresh status
                </Button>
                <Button
                  className="rounded-full"
                  disabled={isPending}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={cancelSession}
                >
                  Cancel / try again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {destinations.length === 0 && session?.status !== "pending" ? (
          <p className="text-sm text-muted-foreground">
            No Telegram accounts connected yet. Connect your phone to receive merchant alerts.
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {destinations.map((destination) => (
            <li
              key={destination.id}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{destination.label}</p>
                  <Badge variant={destination.enabled ? "secondary" : "outline"}>
                    {destination.enabled ? "Enabled" : "Paused"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Connected {new Date(destination.connectedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Switch
                  checked={destination.enabled}
                  disabled={isPending}
                  onCheckedChange={(checked) => toggleEnabled(destination.id, checked)}
                />
                <Button
                  className="rounded-full"
                  disabled={isPending || !destination.enabled}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => sendTest(destination.id)}
                >
                  Send test
                </Button>
                <Button
                  className="rounded-full"
                  disabled={isPending}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => removeDestination(destination.id)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-full"
            disabled={isPending || session?.status === "pending"}
            type="button"
            onClick={startConnect}
          >
            {destinations.length ? "Connect another account" : "Connect Telegram"}
          </Button>
          <Button
            className="rounded-full"
            disabled={isPending}
            type="button"
            variant="outline"
            onClick={() => void loadDestinations()}
          >
            Refresh list
          </Button>
        </div>

        {destinations.length > 0 ? (
          <div className="space-y-3 border-t pt-4">
            <div>
              <p className="text-sm font-medium">Events for all Telegram accounts</p>
              <p className="text-xs text-muted-foreground">
                Shared across every connected chat. Apply after connecting accounts.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {EVENT_OPTIONS.map((event) => {
                const checked = events.includes(event.id);
                return (
                  <label
                    key={event.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      checked ? "border-primary/40 bg-primary/5" : "border-border",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={isPending}
                      onCheckedChange={(value) => {
                        setEvents((current) =>
                          value === true
                            ? [...new Set([...current, event.id])]
                            : current.filter((id) => id !== event.id),
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
              disabled={isPending || events.length === 0}
              type="button"
              onClick={saveEvents}
            >
              Save Telegram events
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
