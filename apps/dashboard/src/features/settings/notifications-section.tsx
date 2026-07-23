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
  NotificationChannelUnavailable,
  NotificationEventPicker,
  NotificationStatusBadge,
  sameNotificationEvents,
} from "@/features/settings/notification-channel-ui";
import {
  SectionIntro,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
import { TelegramConnectPanel } from "@/features/settings/telegram-connect-panel";
import type { NotificationPreference } from "@/lib/merchant-notifications";
import { useI18n } from "@/i18n/provider";
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
  const { t } = useI18n();
  const emailFieldId = useId();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saved, setSaved] = useState<EmailState>(emptyEmailState());
  const [emailInput, setEmailInput] = useState("");
  const [eventsDraft, setEventsDraft] = useState<string[]>(defaultNotificationEvents());
  const [emailAvailable, setEmailAvailable] = useState(true);
  const [telegramAvailable, setTelegramAvailable] = useState(true);
  const [savingTarget, setSavingTarget] = useState(false);
  const [savingEvents, setSavingEvents] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasEmail = saved.target.trim().length > 0;
  const targetDirty = emailInput.trim() !== saved.target.trim();
  const eventsDirty = !sameNotificationEvents(eventsDraft, saved.events);
  const status = !emailAvailable
    ? "not_set_up"
    : !hasEmail
      ? "not_set_up"
      : saved.enabled
        ? "active"
        : "paused";
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
      const channels = data?.channels as
        | { email?: { available?: boolean }; telegram?: { available?: boolean } }
        | undefined;
      setEmailAvailable(channels?.email?.available !== false);
      setTelegramAvailable(channels?.telegram?.available !== false);
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
      toast.error(t("settings.notifications.toast.enterEmail"));
      return;
    }
    if (!isValidNotificationEmail(target)) {
      toast.error(t("settings.notifications.toast.invalidEmail"));
      return;
    }

    setSavingTarget(true);
    startTransition(async () => {
      try {
        await upsertEmail({
          target,
          enabled: hasEmail ? saved.enabled : true,
          events: hasEmail ? saved.events : defaultNotificationEvents(),
          successMessage: hasEmail
            ? t("settings.notifications.toast.emailUpdated")
            : t("settings.notifications.toast.emailSetup"),
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
      toast.error(t("settings.notifications.toast.saveEmailFirst"));
      return;
    }
    if (eventsDraft.length === 0) {
      toast.error(t("settings.notifications.toast.selectEvent"));
      return;
    }

    setSavingEvents(true);
    startTransition(async () => {
      try {
        await upsertEmail({
          target: saved.target,
          enabled: saved.enabled,
          events: eventsDraft,
          successMessage: t("settings.notifications.toast.eventsSaved"),
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
          successMessage: enabled
            ? t("settings.notifications.toast.alertsResumed")
            : t("settings.notifications.toast.alertsPaused"),
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
            ? t("settings.notifications.toast.testQueued")
            : t("settings.notifications.toast.testRequested"),
        );
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  if (loading) {
    return (
      <SettingsSectionBody>
        <SectionIntro
          description={t("settings.notifications.intro")}
          title={t("settings.sections.notifications.label")}
        />
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
        <Card size="sm">
          <NotificationChannelHeader
            description={t("settings.notifications.loadingEmail")}
            onRefresh={() => undefined}
            refreshing
            title={t("settings.notifications.email")}
          />
          <CardContent className="pt-3">
            <div className="h-28 animate-pulse rounded-lg bg-muted/50" />
          </CardContent>
        </Card>
      </SettingsSectionBody>
    );
  }

  if (loadError) {
    return (
      <SettingsSectionBody>
        <SectionIntro
          description={t("settings.notifications.intro")}
          title={t("settings.sections.notifications.label")}
        />
        <Alert variant="destructive">
          <AlertTitle>{t("settings.notifications.loadErrorTitle")}</AlertTitle>
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
              {t("settings.notifications.tryAgain")}
            </Button>
          </AlertDescription>
        </Alert>
      </SettingsSectionBody>
    );
  }

  return (
    <SettingsSectionBody>
      <SectionIntro
        description={t("settings.notifications.intro")}
        title={t("settings.sections.notifications.label")}
      />

      <TelegramConnectPanel available={telegramAvailable} tenantId={tenantId} />

      <Card size="sm">
        <NotificationChannelHeader
          badge={<NotificationStatusBadge status={status} />}
          description={t("settings.notifications.emailDescription")}
          disabled={isPending || !emailAvailable}
          onRefresh={refresh}
          refreshLabel={t("settings.notifications.refreshEmail")}
          refreshing={refreshing}
          title={t("settings.notifications.email")}
        />

        <CardContent className="flex flex-col gap-4 pt-3">
          {!emailAvailable ? (
            <NotificationChannelUnavailable
              description={t("settings.notifications.emailUnavailableDescription")}
              title={t("settings.notifications.emailUnavailableTitle")}
            />
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor={emailFieldId}>{t("settings.notifications.emailAddress")}</FieldLabel>
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
                          {t("common.saving")}
                        </>
                      ) : (
                        t("common.save")
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  {mailtoHref ? (
                    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
                      {t("settings.notifications.alertsGoTo")}{" "}
                      <a
                        className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                        href={mailtoHref}
                      >
                        {saved.target.trim()}
                        <AppIcons.externalLink className="size-3 opacity-60" />
                      </a>
                      . {t("settings.notifications.changeAndSave")}
                    </span>
                  ) : (
                    t("settings.notifications.oneInbox")
                  )}
                </FieldDescription>
              </Field>

              {hasEmail ? (
                <div
                  className={cn(
                    "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                    !saved.enabled && "opacity-90",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t("settings.notifications.delivery")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.notifications.pauseWithoutRemoving")}
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
                          aria-label={t("settings.notifications.sendTestAria")}
                          className="rounded-full"
                          disabled={isPending || !saved.enabled || targetDirty}
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={sendEmailTest}
                        >
                          {t("settings.notifications.sendTest")}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {targetDirty
                          ? t("settings.notifications.saveBeforeTest")
                          : t("settings.notifications.sendTestHint")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ) : null}

              {hasEmail ? (
                <NotificationEventPicker
                  description={t("settings.notifications.eventsDescription")}
                  dirty={eventsDirty}
                  disabled={isPending}
                  events={eventsDraft}
                  saving={savingEvents}
                  onChange={setEventsDraft}
                  onSave={saveEvents}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </SettingsSectionBody>
  );
}
