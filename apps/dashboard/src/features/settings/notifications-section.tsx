"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TelegramConnectPanel } from "@/features/settings/telegram-connect-panel";
import type { NotificationPreference } from "@/lib/merchant-notifications";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { cn } from "@/lib/utils";

const EVENT_OPTIONS = [
  { id: "order.created", label: "New orders" },
  { id: "order.cancelled", label: "Cancelled orders" },
  { id: "payment.paid", label: "Payments received" },
  { id: "payment.failed", label: "Payment failures" },
  { id: "cod_order.created", label: "COD orders" },
] as const;

const ALWAYS_ON_EVENTS = ["notification.test"] as const;

type EmailDraft = {
  enabled: boolean;
  target: string;
  events: string[];
};

function emptyEmailDraft(): EmailDraft {
  return {
    enabled: true,
    target: "",
    events: EVENT_OPTIONS.map((event) => event.id),
  };
}

function draftFromPreferences(preferences: NotificationPreference[]): EmailDraft {
  const match = preferences.find((preference) => preference.channel === "email");
  if (!match) {
    return emptyEmailDraft();
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
  const [draft, setDraft] = useState<EmailDraft>(emptyEmailDraft());
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
      setDraft(draftFromPreferences(list));
    } catch {
      setLoadError(mapPlatformErrorMessage("platform_request_failed"));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const emailConfigured = preferences.some((p) => p.channel === "email" && p.enabled);

  function saveEmail() {
    if (!draft.target.trim()) {
      toast.error("Enter an email before saving.");
      return;
    }
    if (draft.events.length === 0) {
      toast.error("Select at least one event.");
      return;
    }

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
              channel: "email",
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
        toast.success("Email channel saved");
        await load();
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  function sendEmailTest() {
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
              channel: "email",
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
        toast.success(
          data?.jobEnqueued
            ? "Test queued. Email still uses the log provider (no real SMTP yet)."
            : "Test log created. Start Redis + platform worker to process delivery.",
        );
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
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
        <AlertTitle>Telegram is live; email is still log-only</AlertTitle>
        <AlertDescription>
          Connect Telegram accounts with the bot (no chat ID). Real email delivery comes later —
          email test still goes through the jobs pipeline with the log provider.
        </AlertDescription>
      </Alert>

      <TelegramConnectPanel tenantId={tenantId} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Email</CardTitle>
            <CardDescription>
              Operational alerts to a merchant inbox. SMTP/provider integration is deferred.
            </CardDescription>
          </div>
          <Badge variant={emailConfigured && draft.enabled ? "secondary" : "outline"}>
            {emailConfigured && draft.enabled ? "Enabled" : "Not active"}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">
                When off, no email deliveries are created.
              </p>
            </div>
            <Switch
              checked={draft.enabled}
              disabled={isPending}
              onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))}
            />
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="notif-email-target">Recipient email</FieldLabel>
              <Input
                id="notif-email-target"
                type="email"
                value={draft.target}
                disabled={isPending}
                placeholder="owner@example.com"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, target: event.target.value }))
                }
              />
              <FieldDescription>Used when email provider is wired.</FieldDescription>
            </Field>
          </FieldGroup>

          <div className="space-y-2">
            <p className="text-sm font-medium">Events</p>
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
                      disabled={isPending}
                      onCheckedChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          events:
                            value === true
                              ? [...new Set([...current.events, event.id])]
                              : current.events.filter((id) => id !== event.id),
                        }))
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
              disabled={isPending}
              type="button"
              onClick={saveEmail}
            >
              {isPending ? "Saving…" : "Save email"}
            </Button>
            <Button
              className="rounded-full"
              disabled={isPending || !emailConfigured}
              type="button"
              variant="outline"
              onClick={sendEmailTest}
            >
              Send test
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
