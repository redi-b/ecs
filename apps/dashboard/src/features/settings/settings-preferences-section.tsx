"use client";

import type { UserCalendarPreference } from "@ecs/date-time";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCalendarPreference } from "@/components/providers/calendar-preference-provider";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldTitle } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  SectionIntro,
  SettingsPanel,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const calendarOptions = ["follow-language", "ethiopian", "gregorian"] as const;

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
  tenantId: string;
}) {
  const { t } = useI18n();
  const { preference: savedPreference, setPreference: setActivePreference } =
    useCalendarPreference();
  const [calendarPreference, setCalendarPreference] =
    useState<UserCalendarPreference>(savedPreference);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const calendarDirty = calendarPreference !== savedPreference;

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
      <SectionIntro title={t("settings.sections.preferences.label")} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SettingsPanel
          description={t("settings.accountSecurity.calendar.description")}
          title={t("settings.accountSecurity.calendar.title")}
          contentClassName="flex flex-col gap-3"
        >
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {calendarOptions.map((value) => (
              <button
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition-colors",
                  calendarPreference === value
                    ? "border-primary/40 bg-primary/8"
                    : "hover:bg-muted/40",
                )}
                key={value}
                onClick={() => setCalendarPreference(value)}
                type="button"
              >
                <span className="block text-sm font-medium">
                  {t(`settings.accountSecurity.calendar.${value}.title`)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t(`settings.accountSecurity.calendar.${value}.description`)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
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

        {canShowLaunchAssistant ? (
          <SettingsPanel
            description={t("settings.preferences.dashboardDescription")}
            title={t("settings.preferences.dashboardTitle")}
          >
            <Field
              className="rounded-lg border border-border/70 bg-muted/15 p-3"
              orientation="horizontal"
            >
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
          contentClassName="flex flex-col gap-3"
        >
          <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-3 text-sm">
            <p className="font-medium text-foreground">{t("settings.preferences.currencyEtb")}</p>
            <p className="mt-1 text-muted-foreground">{t("settings.preferences.currencyHint")}</p>
          </div>
          {canOpenFulfillment ? (
            <p className="text-sm text-muted-foreground">
              {t("settings.preferences.fulfillmentHint")}
            </p>
          ) : null}
          {canOpenFulfillment ? (
            <Button
              className="w-full rounded-full sm:w-fit"
              onClick={onOpenFulfillment}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("settings.preferences.openFulfillment")}
            </Button>
          ) : null}
        </SettingsPanel>
      </div>
    </SettingsSectionBody>
  );
}
