"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { NotificationPreference } from "@/lib/merchant-notifications";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { cn } from "@/lib/utils";

const CHANNELS = [
  {
    id: "email" as const,
    label: "Email",
    description: "Operational alerts to a merchant inbox. Real SMTP comes later; tests use the log provider.",
    targetLabel: "Recipient email",
    targetPlaceholder: "owner@example.com",
    targetType: "email",
  },
  {
    id: "telegram" as const,
    label: "Telegram",
    description: "Chat ID for bot delivery. Connect flow later; paste chat ID for now.",
    targetLabel: "Telegram chat ID",
    targetPlaceholder: "123456789",
    targetType: "text",
  },
] as const;

const EVENT_OPTIONS = [
  { id: "order.created", label: "New orders" },
  { id: "order.cancelled", label: "Cancelled orders" },
  { id: "payment.paid", label: "Payments received" },
  { id: "payment.failed", label: "Payment failures" },
  { id: "cod_order.created", label: "COD orders" },
] as const;

/** Always included so test sends and future defaults stay valid on the API. */
const ALWAYS_ON_EVENTS = ["notification.test"] as const;

type ChannelId = (typeof CHANNELS)[number]["id"];

type ChannelDraft = {
  enabled: boolean;
  target: string;
  events: string[];
};

function emptyDraft(): ChannelDraft {
  return {
    enabled: true,
    target: "",
    events: EVENT_OPTIONS.map((event) => event.id),
  };
}

function draftFromPreferences(
  channel: ChannelId,
  preferences: NotificationPreference[],
): ChannelDraft {
  const match = preferences.find((preference) => preference.channel === channel);
  if (!match) {
    return emptyDraft();
  }

  const events = match.events.includes("*")
    ? EVENT_OPTIONS.map((event) => event.id)
    : EVENT_OPTIONS.map((event) => event.id).filter((id) => match.events.includes(id));

  return {
    enabled: match.enabled,
    target: match.target,
    events: events.length > 0 ? events : EVENT_OPTIONS.map((event) => event.id),
  };
}

function buildEventsPayload(selected: string[]) {
  return [...new Set([...selected, ...ALWAYS_ON_EVENTS])];
}

export function NotificationsSection({ tenantId }: { tenantId: string }) {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<ChannelId, ChannelDraft>>({
    email: emptyDraft(),
    telegram: emptyDraft(),
  });
  const [pendingChannel, setPendingChannel] = useState<ChannelId | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/admin/settings/notifications?tenantId=${encodeURIComponent(tenantId)}`,
        {
          headers: { accept: "application/json" },
          cache: "no-store",
        },
      );
      const data = await response.json().catch(() => undefined);
      if (!response.ok) {
        const code =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
              ? data.message
              : "notifications_unavailable";
        setLoadError(mapPlatformErrorMessage(code));
        return;
      }
      const list = Array.isArray(data?.preferences)
        ? (data.preferences as NotificationPreference[])
        : [];
      setPreferences(list);
      setDrafts({
        email: draftFromPreferences("email", list),
        telegram: draftFromPreferences("telegram", list),
      });
    } catch {
      setLoadError(mapPlatformErrorMessage("platform_request_failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, tenantId]);

  const configuredChannels = useMemo(
    () => new Set(preferences.filter((p) => p.enabled).map((p) => p.channel)),
    [preferences],
  );

  function updateDraft(channel: ChannelId, patch: Partial<ChannelDraft>) {
    setDrafts((current) => ({
      ...current,
      [channel]: { ...current[channel], ...patch },
    }));
  }

  function toggleEvent(channel: ChannelId, eventId: string, checked: boolean) {
    setDrafts((current) => {
      const draft = current[channel];
      const events = checked
        ? [...new Set([...draft.events, eventId])]
        : draft.events.filter((id) => id !== eventId);
      return {
        ...current,
        [channel]: { ...draft, events },
      };
    });
  }

  function saveChannel(channel: ChannelId) {
    const draft = drafts[channel];
    if (!draft.target.trim()) {
      toast.error("Enter a destination before saving.");
      return;
    }
    if (draft.events.length === 0) {
      toast.error("Select at least one event.");
      return;
    }

    setPendingChannel(channel);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/admin/settings/notifications?tenantId=${encodeURIComponent(tenantId)}`,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              action: "upsert",
              channel,
              enabled: draft.enabled,
              target: draft.target.trim(),
              events: buildEventsPayload(draft.events),
            }),
          },
        );
        const data = await response.json().catch(() => undefined);
        if (!response.ok) {
          const code =
            typeof data?.error === "string"
              ? data.error
              : typeof data?.message === "string"
                ? data.message
                : "notifications_unavailable";
          toast.error(mapPlatformErrorMessage(code));
          return;
        }
        toast.success(`${CHANNELS.find((c) => c.id === channel)?.label ?? channel} saved`);
        await load();
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      } finally {
        setPendingChannel(null);
      }
    });
  }

  function sendTest(channel: ChannelId) {
    setPendingChannel(channel);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/admin/settings/notifications?tenantId=${encodeURIComponent(tenantId)}`,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              action: "test",
              channel,
            }),
          },
        );
        const data = await response.json().catch(() => undefined);
        if (!response.ok) {
          const code =
            typeof data?.error === "string"
              ? data.error
              : typeof data?.message === "string"
                ? data.message
                : "notification_preference_missing";
          toast.error(mapPlatformErrorMessage(code));
          return;
        }
        const enqueued = data?.jobEnqueued === true;
        toast.success(
          enqueued
            ? "Test queued. With the platform worker running, the log provider will mark it sent."
            : "Test log created. Start Redis + platform worker to process delivery.",
        );
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      } finally {
        setPendingChannel(null);
      }
    });
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Loading notification preferences…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Notifications unavailable</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertTitle>Delivery uses the log provider for now</AlertTitle>
        <AlertDescription>
          Email and Telegram are not sending real messages yet. Saving preferences and sending a
          test still exercises the jobs pipeline: pending log → worker → <code>sent</code> with a
          log reference. Wire real providers later without changing this screen.
        </AlertDescription>
      </Alert>

      {CHANNELS.map((channel) => {
        const draft = drafts[channel.id];
        const busy = isPending && pendingChannel === channel.id;
        const configured = configuredChannels.has(channel.id);

        return (
          <Card key={channel.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">{channel.label}</CardTitle>
                <CardDescription>{channel.description}</CardDescription>
              </div>
              <Badge variant={configured && draft.enabled ? "secondary" : "outline"}>
                {configured && draft.enabled ? "Enabled" : "Not active"}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Enabled</p>
                  <p className="text-xs text-muted-foreground">
                    When off, no deliveries are created for this channel.
                  </p>
                </div>
                <Switch
                  checked={draft.enabled}
                  disabled={busy}
                  onCheckedChange={(checked) => updateDraft(channel.id, { enabled: checked })}
                />
              </div>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={`notif-target-${channel.id}`}>{channel.targetLabel}</FieldLabel>
                  <Input
                    id={`notif-target-${channel.id}`}
                    type={channel.targetType}
                    value={draft.target}
                    disabled={busy}
                    placeholder={channel.targetPlaceholder}
                    onChange={(event) => updateDraft(channel.id, { target: event.target.value })}
                  />
                  <FieldDescription>
                    Stored as the delivery target. Real provider integration will use the same field.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <div className="space-y-2">
                <p className="text-sm font-medium">Events</p>
                <p className="text-xs text-muted-foreground">
                  Choose which commerce events create deliveries for this channel.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EVENT_OPTIONS.map((event) => {
                    const checked = draft.events.includes(event.id);
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
                          disabled={busy}
                          onCheckedChange={(value) =>
                            toggleEvent(channel.id, event.id, value === true)
                          }
                        />
                        <span>{event.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-full"
                  disabled={busy}
                  type="button"
                  onClick={() => saveChannel(channel.id)}
                >
                  {busy ? "Saving…" : "Save channel"}
                </Button>
                <Button
                  className="rounded-full"
                  disabled={busy || !configured}
                  type="button"
                  variant="outline"
                  onClick={() => sendTest(channel.id)}
                >
                  Send test
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
