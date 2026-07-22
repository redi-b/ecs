"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldTitle,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { SectionIntro } from "@/features/settings/settings-sections";
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
    <div className="flex flex-col gap-6">
      <SectionIntro
        description={t("settings.preferences.intro")}
        title={t("settings.sections.preferences.label")}
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{t("settings.preferences.dashboardTitle")}</CardTitle>
            <CardDescription>{t("settings.preferences.dashboardDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Field className="rounded-lg border p-3" orientation="horizontal">
              <FieldContent>
                <FieldTitle>{t("settings.preferences.launchTitle")}</FieldTitle>
                <FieldDescription>{t("settings.preferences.launchDescription")}</FieldDescription>
              </FieldContent>
              <Switch checked={showLaunchAssistant} onCheckedChange={onLaunchAssistantChange} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{t("settings.preferences.commerceTitle")}</CardTitle>
            <CardDescription>{t("settings.preferences.commerceDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border bg-muted/20 px-3 py-3 text-sm">
              <p className="font-medium text-foreground">{t("settings.preferences.currencyEtb")}</p>
              <p className="mt-1 text-muted-foreground">{t("settings.preferences.currencyHint")}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("settings.preferences.fulfillmentHint")}
            </p>
            <Button
              className="w-fit rounded-full"
              onClick={onOpenFulfillment}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("settings.preferences.openFulfillment")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
