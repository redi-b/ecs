"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildNotificationEventsPayload,
  defaultNotificationEvents,
  isValidNotificationEmail,
  normalizeNotificationEvents,
  NotificationAlertsSwitch,
  NotificationChannelHeader,
  NotificationEventPicker,
  NotificationStatusBadge,
  sameNotificationEvents,
} from "@/features/settings/notification-channel-ui";
import { TelegramConnectPanel } from "@/features/settings/telegram-connect-panel";
import type { NotificationPreference } from "@/lib/merchant-notifications";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { cn } from "@/lib/utils";

type EmailState = {
  target: string;
  enabled: boolean;
  events: string[];
};

function emptyEmailState(): EmailState {
  return {
    target: "",
    enabled: true,
    events: defaultNotificationEvents(),
  };
}

function emailStateFromPreferences(preferences: NotificationPreference[]): EmailState {
  const match = preferences.find((preference) => preference.channel === "email");
  if (!match) {
    return emptyEmailState();
  }
  return {
    target: match.target,
    enabled: match.enabled,
    events: normalizeNotificationEvents(match.events),
  };
}

export function NotificationsSection({ tenantId }: { tenantId: string }) {
  const emailFieldId = useId();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saved, setSaved] = useState<EmailState>(emptyEmailState());
  const [emailInput, setEmailInput] = useState("");
  const [eventsDraft, setEventsDraft] = useState<string[]>(defaultNotificationEvents());
  const [savingTarget, setSavingTarget] = useState(false);
  const [savingEvents, setSavingEvents] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasEmail = saved.target.trim().length > 0;
  const targetDirty = emailInput.trim() !== saved.target.trim();
  const eventsDirty = !sameNotificationEvents(eventsDraft, saved.events);
  const status = !hasEmail ? "not_set_up" : saved.enabled ? "active" : "paused";
  const mailtoHref =
    hasEmail && isValidNotificationEmail(saved.target)
      ? `mailto:${saved.target.trim()}`
      : null;

  const applyState = useCallback((next: EmailState) => {
    setSaved(next);
    setEmailInput(next.target);
    setEventsDraft(next.events);
  }, []);

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
      applyState(emailStateFromPreferences(list));
    } catch {
      setLoadError(mapPlatformErrorMessage("platform_request_failed"));
    }
  }, [applyState, tenantId]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  function refresh() {
    setRefreshing(true);
    void load()
      .catch(() => {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      })
      .finally(() => setRefreshing(false));
  }

  async function upsertEmail(input: {
    target: string;
    enabled: boolean;
    events: string[];
    successMessage: string;
  }) {
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
          enabled: input.enabled,
          target: input.target.trim(),
          events: buildNotificationEventsPayload(input.events),
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
      return false;
    }
    toast.success(input.successMessage);
    await load();
    return true;
  }

  function saveTarget() {
    const target = emailInput.trim();
    if (!target) {
      toast.error("Enter an email address before saving.");
      return;
    }
    if (!isValidNotificationEmail(target)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setSavingTarget(true);
    startTransition(async () => {
      try {
        await upsertEmail({
          target,
          enabled: hasEmail ? saved.enabled : true,
          events: hasEmail ? saved.events : defaultNotificationEvents(),
          successMessage: hasEmail ? "Email address updated" : "Email alerts set up",
        });
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      } finally {
        setSavingTarget(false);
      }
    });
  }

  function saveEvents() {
    if (!hasEmail) {
      toast.error("Save an email address first.");
      return;
    }
    if (eventsDraft.length === 0) {
      toast.error("Select at least one event.");
      return;
    }

    setSavingEvents(true);
    startTransition(async () => {
      try {
        await upsertEmail({
          target: saved.target,
          enabled: saved.enabled,
          events: eventsDraft,
          successMessage: "Event preferences saved",
        });
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      } finally {
        setSavingEvents(false);
      }
    });
  }

  function toggleEnabled(enabled: boolean) {
    if (!hasEmail) return;
    // Optimistic UI; reload reconciles.
    setSaved((current) => ({ ...current, enabled }));
    startTransition(async () => {
      try {
        const ok = await upsertEmail({
          target: saved.target,
          enabled,
          events: saved.events,
          successMessage: enabled ? "Alerts resumed" : "Alerts paused",
        });
        if (!ok) {
          setSaved((current) => ({ ...current, enabled: !enabled }));
        }
      } catch {
        setSaved((current) => ({ ...current, enabled: !enabled }));
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

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <SectionIntro
          description="Get notified when orders, payments, and other shop events happen."
          title="Notifications"
        />
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
        <Card>
          <NotificationChannelHeader
            description="Loading email settings…"
            onRefresh={() => undefined}
            refreshing
            title="Email"
          />
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
        <NotificationChannelHeader
          badge={<NotificationStatusBadge status={status} />}
          description="Send shop event alerts to one mailbox for this shop."
          disabled={isPending}
          onRefresh={refresh}
          refreshLabel="Refresh email settings"
          refreshing={refreshing}
          title="Email"
        />

        <CardContent className="flex flex-col gap-5">
          <Field>
            <FieldLabel htmlFor={emailFieldId}>Email address</FieldLabel>
            <InputGroup>
              <InputGroupInput
                autoComplete="email"
                disabled={isPending || savingTarget}
                id={emailFieldId}
                placeholder="you@business.com"
                type="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (targetDirty && !savingTarget) saveTarget();
                  }
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-busy={savingTarget}
                  className="rounded-full"
                  disabled={isPending || savingTarget || !targetDirty}
                  size="xs"
                  type="button"
                  variant="secondary"
                  onClick={saveTarget}
                >
                  {savingTarget ? (
                    <>
                      <AppIcons.loader className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              {mailtoHref ? (
                <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
                  Alerts go to{" "}
                  <a
                    className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                    href={mailtoHref}
                  >
                    {saved.target.trim()}
                    <AppIcons.externalLink className="size-3 opacity-60" />
                  </a>
                  . Change the address above and press Save.
                </span>
              ) : (
                "One inbox for this shop. Press Save to start receiving alerts."
              )}
            </FieldDescription>
          </Field>

          {hasEmail ? (
            <div
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                !saved.enabled && "bg-muted/20 opacity-90",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">Delivery</p>
                <p className="text-xs text-muted-foreground">
                  Pause without removing the email address.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                <NotificationAlertsSwitch
                  checked={saved.enabled}
                  disabled={isPending}
                  onCheckedChange={toggleEnabled}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Send test email"
                      className="rounded-full"
                      disabled={isPending || !saved.enabled || targetDirty}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={sendEmailTest}
                    >
                      Send test
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {targetDirty
                      ? "Save the email address before sending a test"
                      : "Send a test alert to this address"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : null}

          {hasEmail ? (
            <NotificationEventPicker
              description="Choose which shop events trigger email."
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
