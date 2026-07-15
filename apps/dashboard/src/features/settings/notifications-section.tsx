"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function sameEvents(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

export function NotificationsSection({ tenantId }: { tenantId: string }) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState<EmailDraft>(emptyEmailDraft());
  const [savedDraft, setSavedDraft] = useState<EmailDraft>(emptyEmailDraft());
  const [hasSavedEmail, setHasSavedEmail] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
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
      const nextDraft = draftFromPreferences(list);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      setHasSavedEmail(list.some((p) => p.channel === "email" && p.target.trim().length > 0));
    } catch {
      setLoadError(mapPlatformErrorMessage("platform_request_failed"));
    }
  }, [tenantId]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const dirty = useMemo(() => {
    return (
      draft.enabled !== savedDraft.enabled ||
      draft.target.trim() !== savedDraft.target.trim() ||
      !sameEvents(draft.events, savedDraft.events)
    );
  }, [draft, savedDraft]);

  const emailActive = hasSavedEmail && draft.enabled;
  const canTest = hasSavedEmail && savedDraft.enabled && !dirty;
  const mailtoHref =
    hasSavedEmail && isValidEmail(savedDraft.target)
      ? `mailto:${savedDraft.target.trim()}`
      : null;

  function refresh() {
    setRefreshing(true);
    void load()
      .catch(() => {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      })
      .finally(() => setRefreshing(false));
  }

  function saveEmail() {
    if (!draft.target.trim()) {
      toast.error("Enter an email address before saving.");
      return;
    }
    if (!isValidEmail(draft.target)) {
      toast.error("Enter a valid email address.");
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
        toast.success("Email alerts saved");
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
            ? "Test email queued. Check your inbox shortly."
            : "Test email requested.",
        );
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  function resetDraft() {
    setDraft(savedDraft);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <SectionIntro
          description="Get notified when orders, payments, and other shop events happen."
          title="Notifications"
        />
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Telegram</CardTitle>
            <CardDescription>Loading connected accounts…</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-24 animate-pulse rounded-lg bg-muted/50" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Email</CardTitle>
            <CardDescription>Loading email settings…</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-28 animate-pulse rounded-lg bg-muted/50" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-6">
        <SectionIntro
          description="Get notified when orders, payments, and other shop events happen."
          title="Notifications"
        />
        <Alert variant="destructive">
          <AlertTitle>Couldn’t load notifications</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{loadError}</span>
            <Button
              className="w-fit rounded-full"
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setLoading(true);
                void load().finally(() => setLoading(false));
              }}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionIntro
        description="Get notified when orders, payments, and other shop events happen."
        title="Notifications"
      />

      <TelegramConnectPanel tenantId={tenantId} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Email</CardTitle>
              <Badge variant={emailActive ? "secondary" : "outline"}>
                {emailActive ? "Active" : hasSavedEmail ? "Paused" : "Not set up"}
              </Badge>
              {dirty ? (
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
                  Unsaved
                </Badge>
              ) : null}
            </div>
            <CardDescription>
              Send shop event alerts to a mailbox you check regularly.
            </CardDescription>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-busy={refreshing}
                aria-label={refreshing ? "Refreshing" : "Refresh email settings"}
                className="shrink-0"
                disabled={refreshing || isPending}
                size="icon-sm"
                type="button"
                variant="outline"
                onClick={refresh}
              >
                <AppIcons.refresh className={refreshing ? "animate-spin" : undefined} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{refreshing ? "Refreshing" : "Refresh"}</TooltipContent>
          </Tooltip>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {!hasSavedEmail ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-center">
              <div className="flex size-11 items-center justify-center rounded-full border bg-background shadow-sm">
                <AppIcons.mail className="size-5 text-muted-foreground" />
              </div>
              <div className="max-w-sm space-y-1">
                <p className="text-sm font-medium text-foreground">No email alerts yet</p>
                <p className="text-sm text-muted-foreground">
                  Add a recipient below to get order and payment updates by email.
                </p>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                !draft.enabled && "bg-muted/20 opacity-90",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {mailtoHref ? (
                    <a
                      className="inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                      href={mailtoHref}
                    >
                      <span className="truncate">{savedDraft.target.trim()}</span>
                      <AppIcons.externalLink className="size-3 shrink-0 opacity-60" />
                    </a>
                  ) : (
                    <p className="truncate text-sm font-semibold">{savedDraft.target.trim()}</p>
                  )}
                  <Badge variant={savedDraft.enabled ? "secondary" : "outline"}>
                    {savedDraft.enabled ? "Active" : "Paused"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Saved recipient for shop event alerts
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                <div className="mr-1 flex items-center gap-2 rounded-full border bg-background px-2.5 py-1">
                  <span className="text-xs text-muted-foreground">Alerts</span>
                  <Switch
                    checked={draft.enabled}
                    disabled={isPending}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, enabled: checked }))
                    }
                  />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Send test email"
                      className="rounded-full"
                      disabled={isPending || !canTest}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={sendEmailTest}
                    >
                      Send test
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {dirty
                      ? "Save changes before sending a test"
                      : "Send a test alert to this address"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          <div className="space-y-4 rounded-xl border bg-muted/15 p-4">
            <div>
              <p className="text-sm font-medium">Recipient</p>
              <p className="text-xs text-muted-foreground">
                One inbox for this shop. You can change it anytime.
              </p>
            </div>

            {!hasSavedEmail ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Email alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Turn off later to pause delivery without removing the address.
                  </p>
                </div>
                <Switch
                  checked={draft.enabled}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, enabled: checked }))
                  }
                />
              </div>
            ) : null}

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="notif-email-target">Email address</FieldLabel>
                <Input
                  id="notif-email-target"
                  type="email"
                  autoComplete="email"
                  value={draft.target}
                  disabled={isPending}
                  placeholder="you@business.com"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, target: event.target.value }))
                  }
                />
                <FieldDescription>Where shop event alerts should be delivered.</FieldDescription>
              </Field>
            </FieldGroup>

            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Notify me about</p>
                <p className="text-xs text-muted-foreground">Choose which events trigger email.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {EVENT_OPTIONS.map((event) => {
                  const checked = draft.events.includes(event.id);
                  return (
                    <label
                      key={event.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition-colors",
                        checked
                          ? "border-primary/40 bg-primary/5"
                          : "border-border hover:bg-muted/40",
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
                disabled={isPending || !dirty}
                size="sm"
                type="button"
                onClick={saveEmail}
              >
                {isPending ? "Saving…" : hasSavedEmail ? "Save changes" : "Save email"}
              </Button>
              {dirty && hasSavedEmail ? (
                <Button
                  className="rounded-full"
                  disabled={isPending}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={resetDraft}
                >
                  Discard
                </Button>
              ) : null}
              {!hasSavedEmail ? (
                <Button
                  className="rounded-full"
                  disabled={isPending || !canTest}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={sendEmailTest}
                >
                  Send test
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionIntro({ description, title }: { description: string; title: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
