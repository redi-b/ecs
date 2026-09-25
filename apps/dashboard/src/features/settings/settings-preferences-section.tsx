"use client";

import {
  formatCalendarDate,
  resolveUserCalendarPreference,
  type UserCalendarPreference,
} from "@ecs/date-time";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCalendarPreference } from "@/components/providers/calendar-preference-provider";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldTitle } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import {
  SectionIntro,
  SettingsPanel,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";

const calendarOptions = ["follow-language", "ethiopian", "gregorian"] as const;
const calendarPreviewInstant = "2026-09-24T09:00:00.000Z";

export function PreferencesSection({
  canOpenFulfillment,
  canShowLaunchAssistant,
  onDirtyChange,
  onLaunchAssistantChange,
  onOpenFulfillment,
  showLaunchAssistant,
}: {
  canOpenFulfillment: boolean;
  canShowLaunchAssistant: boolean;
  onDirtyChange?: (changes: readonly string[]) => void;
  onLaunchAssistantChange: (checked: boolean) => void;
  onOpenFulfillment: () => void;
  showLaunchAssistant: boolean;
}) {
  const { locale, t } = useI18n();
  const { preference: savedPreference, setPreference: setActivePreference } =
    useCalendarPreference();
  const [calendarPreference, setCalendarPreference] =
    useState<UserCalendarPreference>(savedPreference);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const calendarDirty = calendarPreference !== savedPreference;
  const selectedCalendarDescription = t(
    `settings.accountSecurity.calendar.${calendarPreference}.description`,
  );
  const preview =
    formatCalendarDate(calendarPreviewInstant, {
      calendar: resolveUserCalendarPreference(calendarPreference),
      locale,
    }) ?? "—";

  useEffect(() => {
    setCalendarPreference(savedPreference);
  }, [savedPreference]);

  useEffect(() => {
    onDirtyChange?.(calendarDirty ? [t("settings.accountSecurity.calendar.title")] : []);
    return () => onDirtyChange?.([]);
  }, [calendarDirty, onDirtyChange, t]);

  async function saveCalendarPreference() {
    if (!calendarDirty || savingCalendar) return;
    setSavingCalendar(true);
    const response = await fetch("/dashboard/account/calendar-preference", {
      body: JSON.stringify({ calendarPreference }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setSavingCalendar(false);
    if (!response?.ok) {
      toast.error(t("settings.preferences.calendarSaveFailed"));
      return;
    }
    setActivePreference(calendarPreference);
    toast.success(t("settings.preferences.calendarSaved"));
  }

  return (
    <SettingsSectionBody>
      <SectionIntro
        description={t("settings.preferences.intro")}
        title={t("settings.sections.preferences.label")}
      />

      <SettingsPanel
        className="overflow-hidden"
        contentClassName="space-y-0 p-0"
        description={t("settings.accountSecurity.calendar.description")}
        title={t("settings.accountSecurity.calendar.title")}
      >
        <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.55fr)] md:items-center">
          <div className="min-w-0 space-y-2.5">
            <SegmentedControl
              active="muted"
              ariaLabel={t("settings.accountSecurity.calendar.title")}
              onChange={setCalendarPreference}
              options={calendarOptions.map((value) => ({
                id: value,
                label: t(`settings.accountSecurity.calendar.${value}.title`),
              }))}
              size="sm"
              value={calendarPreference}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {selectedCalendarDescription}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 md:text-right">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
              {t("common.preview")}
            </p>
            <p className="mt-1 text-sm font-medium tabular-nums text-foreground">{preview}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border/60 bg-muted/10 px-4 py-3">
          <Button
            disabled={!calendarDirty || savingCalendar}
            onClick={() => setCalendarPreference(savedPreference)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("common.cancel")}
          </Button>
          <Button
            className="rounded-full"
            disabled={!calendarDirty || savingCalendar}
            onClick={() => void saveCalendarPreference()}
            size="sm"
            type="button"
          >
            {savingCalendar ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </SettingsPanel>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {canShowLaunchAssistant ? (
          <SettingsPanel
            description={t("settings.preferences.dashboardDescription")}
            title={t("settings.preferences.dashboardTitle")}
          >
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{t("settings.preferences.launchTitle")}</FieldTitle>
                <FieldDescription>{t("settings.preferences.launchDescription")}</FieldDescription>
              </FieldContent>
              <Switch checked={showLaunchAssistant} onCheckedChange={onLaunchAssistantChange} />
            </Field>
          </SettingsPanel>
        ) : null}

        <SettingsPanel
          description={t("settings.preferences.commerceDescription")}
          title={t("settings.preferences.commerceTitle")}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t("settings.preferences.currencyEtb")}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("settings.preferences.currencyHint")}
              </p>
            </div>
            {canOpenFulfillment ? (
              <Button
                className="shrink-0 rounded-full"
                onClick={onOpenFulfillment}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("settings.preferences.openFulfillment")}
              </Button>
            ) : null}
          </div>
        </SettingsPanel>
      </div>
    </SettingsSectionBody>
  );
}
