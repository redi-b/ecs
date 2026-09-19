"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { usePolicy } from "@/components/app/access-context";
import { AppIcons } from "@/components/app/icons";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
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
  ALWAYS_ON_EMAIL_EVENTS,
  defaultNotificationEvents,
  isValidNotificationEmail,
  NotificationChannelHeader,
  NotificationChannelUnavailable,
  NotificationEventPicker,
  NotificationStatusBadge,
  normalizeNotificationEvents,
  sameNotificationEvents,
} from "@/features/settings/notification-channel-ui";
import { SectionIntro, SettingsSectionBody } from "@/features/settings/settings-sections";
import { TelegramConnectPanel } from "@/features/settings/telegram-connect-panel";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useI18n } from "@/i18n/provider";
import { merchantPolicies } from "@/lib/access-policy";
import type { NotificationPreference } from "@/lib/merchant-notifications";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";

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
    enabled: true,
    events: [
      ...new Set([...normalizeNotificationEvents(match.events), ...ALWAYS_ON_EMAIL_EVENTS]),
    ],
  };
}

export function NotificationsSection({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const canManage = usePolicy(merchantPolicies.notificationsManage);
  const emailFieldId = useId();
  const emailInputRef = useRef<HTMLInputElement>(null);
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
  const notificationsDirty = targetDirty || eventsDirty;
  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedChangesGuard(notificationsDirty);
  const status = !emailAvailable
    ? "not_set_up"
    : !hasEmail
      ? "not_set_up"
      : saved.enabled
        ? "active"
        : "paused";
  const mailtoHref =
    hasEmail && isValidNotificationEmail(saved.target) ? `mailto:${saved.target.trim()}` : null;

  const applyState = useCallback((next: EmailState) => {
    setSaved(next);
    setEmailInput(next.target);
    setEventsDraft(next.events);
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch(
        `/dashboard/settings/notifications?tenantId=${encodeURIComponent(tenantId)}`,
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
      `/dashboard/settings/notifications?tenantId=${encodeURIComponent(tenantId)}`,
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
          enabled: true,
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
          enabled: true,
          events: [...new Set([...eventsDraft, ...ALWAYS_ON_EMAIL_EVENTS])],
          successMessage: t("settings.notifications.toast.eventsSaved"),
        });
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      } finally {
        setSavingEvents(false);
      }
    });
  }

  function sendEmailTest() {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/dashboard/settings/notifications?tenantId=${encodeURIComponent(tenantId)}`,
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
        <SectionIntro title={t("settings.sections.notifications.label")} />
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
        <SectionIntro title={t("settings.sections.notifications.label")} />
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
      <SectionIntro title={t("settings.sections.notifications.label")} />

      {canManage ? (
        <TelegramConnectPanel available={telegramAvailable} tenantId={tenantId} />
      ) : null}

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
                <FieldLabel htmlFor={emailFieldId}>
                  {t("settings.notifications.emailAddress")}
                </FieldLabel>
                <InputGroup className="bg-background shadow-xs transition-[border-color,box-shadow] duration-150 ease-[var(--ease-dashboard)] hover:border-ring/45 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
                  <InputGroupAddon align="inline-start">
                    <AppIcons.mail aria-hidden className="size-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    autoComplete="email"
                    disabled={!canManage || isPending || savingTarget}
                    id={emailFieldId}
                    placeholder={t("auth.emailPlaceholder")}
                    type="email"
                    value={emailInput}
                    ref={emailInputRef}
                    onChange={(event) => setEmailInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (targetDirty && !savingTarget) saveTarget();
                      }
                    }}
                  />
                  {canManage ? (
                    <InputGroupAddon align="inline-end">
                      {targetDirty || savingTarget ? (
                        <InputGroupButton
                          aria-busy={savingTarget}
                          className="rounded-full"
                          disabled={isPending || savingTarget}
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
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InputGroupButton
                              aria-label={t("settings.notifications.editEmail")}
                              disabled={isPending}
                              size="icon-xs"
                              type="button"
                              onClick={() => {
                                emailInputRef.current?.focus();
                                emailInputRef.current?.select();
                              }}
                            >
                              <AppIcons.edit />
                            </InputGroupButton>
                          </TooltipTrigger>
                          <TooltipContent>{t("settings.notifications.editEmail")}</TooltipContent>
                        </Tooltip>
                      )}
                    </InputGroupAddon>
                  ) : null}
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
                <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium tracking-tight">
                      {t("settings.notifications.delivery")}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t("settings.notifications.billingEmailAlwaysOn")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    {canManage ? (
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
                    ) : null}
                  </div>
                </div>
              ) : null}

              {hasEmail ? (
                <NotificationEventPicker
                  description={t("settings.notifications.eventsDescription")}
                  dirty={eventsDirty}
                  disabled={!canManage || isPending}
                  events={eventsDraft}
                  lockedEvents={ALWAYS_ON_EMAIL_EVENTS}
                  saving={savingEvents}
                  onChange={setEventsDraft}
                  onSave={saveEvents}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <UnsavedChangesDialog onLeave={confirmLeave} onStay={cancelLeave} open={leaveDialogOpen} />
    </SettingsSectionBody>
  );
}
