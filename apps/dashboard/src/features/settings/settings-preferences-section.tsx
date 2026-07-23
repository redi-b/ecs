"use client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldTitle,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  SectionIntro,
  SettingsPanel,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";

export function PreferencesSection({
  onLaunchAssistantChange,
  onOpenFulfillment,
  showLaunchAssistant,
}: {
  onLaunchAssistantChange: (checked: boolean) => void;
  onOpenFulfillment: () => void;
  showLaunchAssistant: boolean;
  tenantId: string;
}) {
  const { t } = useI18n();
  return (
    <SettingsSectionBody>
      <SectionIntro
        description={t("settings.preferences.intro")}
        title={t("settings.sections.preferences.label")}
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SettingsPanel
          description={t("settings.preferences.dashboardDescription")}
          title={t("settings.preferences.dashboardTitle")}
        >
          <Field className="rounded-lg border border-border/70 bg-muted/15 p-3" orientation="horizontal">
            <FieldContent>
              <FieldTitle>{t("settings.preferences.launchTitle")}</FieldTitle>
              <FieldDescription>{t("settings.preferences.launchDescription")}</FieldDescription>
            </FieldContent>
            <Switch checked={showLaunchAssistant} onCheckedChange={onLaunchAssistantChange} />
          </Field>
        </SettingsPanel>
        <SettingsPanel
          description={t("settings.preferences.commerceDescription")}
          title={t("settings.preferences.commerceTitle")}
          contentClassName="flex flex-col gap-3"
        >
          <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-3 text-sm">
            <p className="font-medium text-foreground">{t("settings.preferences.currencyEtb")}</p>
            <p className="mt-1 text-muted-foreground">{t("settings.preferences.currencyHint")}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("settings.preferences.fulfillmentHint")}
          </p>
          <Button
            className="w-full rounded-full sm:w-fit"
            onClick={onOpenFulfillment}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("settings.preferences.openFulfillment")}
          </Button>
        </SettingsPanel>
      </div>
    </SettingsSectionBody>
  );
}
