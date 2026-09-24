"use client";

import type { StorefrontLanguageSettings } from "@ecs/contracts";
import { RiTranslate2 } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import Link from "@/components/app/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { SettingsPanel } from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";
import { dispatchStorefrontLanguagesChanged } from "@/lib/catalog-label-locale";
import { dashboardRoutes } from "@/lib/routes";

export function StorefrontLanguageSettingsPanel({
  initialSettings,
  onDirtyChange,
  tenantId,
}: {
  initialSettings: StorefrontLanguageSettings;
  onDirtyChange?: ((dirty: boolean) => void) | undefined;
  tenantId: string;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const amharicId = useId();
  const { t } = useI18n();
  const [saved, setSaved] = useState(initialSettings);
  const [pending, startTransition] = useTransition();
  const [languageChange, setLanguageChange] = useState<"enable" | "disable" | null>(null);
  const [defaultChange, setDefaultChange] = useState<"en" | "am" | null>(null);
  const amharicEnabled = settings.enabledLocales.includes("am");
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  function setAmharicEnabled(enabled: boolean) {
    setSettings((current) => ({
      ...current,
      enabledLocales: enabled ? ["en", "am"] : ["en"],
      defaultLocale: enabled ? current.defaultLocale : "en",
    }));
  }

  function save() {
    if (!dirty || pending) return;
    startTransition(async () => {
      const response = await fetch(dashboardRoutes.storefrontLanguagesAction, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, languageSettings: settings }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(t("settings.storefront.languagesSaveFailed"));
        return;
      }
      const nextSettings = result.languageSettings ?? settings;
      setSaved(nextSettings);
      dispatchStorefrontLanguagesChanged(nextSettings.enabledLocales);
      router.refresh();
      toast.success(t("settings.storefront.languagesSaved"));
    });
  }

  return (
    <SettingsPanel
      title={t("settings.storefront.languagesTitle")}
      description={t("settings.storefront.languagesDescription")}
      contentClassName="space-y-5"
    >
      <div className="divide-y rounded-[calc(var(--radius)+0.125rem)] border">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("settings.storefront.languagesEnglish")}</p>
            <p className="text-sm text-muted-foreground">
              {t("settings.storefront.languagesOriginal")}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {t("settings.storefront.languagesAlwaysOn")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <Label className="text-sm font-medium" htmlFor={amharicId}>
              አማርኛ{" "}
              <span className="font-normal text-muted-foreground">
                {t("settings.storefront.languagesAmharic")}
              </span>
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.storefront.languagesAmharicDescription")}
            </p>
          </div>
          <Switch
            checked={amharicEnabled}
            id={amharicId}
            onCheckedChange={(enabled) => setLanguageChange(enabled ? "enable" : "disable")}
          />
        </div>
      </div>

      {amharicEnabled ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            {t("settings.storefront.languagesDefault")}
          </legend>
          <SegmentedControl
            active="muted"
            ariaLabel={t("settings.storefront.languagesDefault")}
            onChange={(locale) => {
              if (settings.defaultLocale !== locale) setDefaultChange(locale);
            }}
            options={[
              { id: "en", label: t("settings.storefront.languagesEnglish") },
              { id: "am", label: "አማርኛ" },
            ]}
            value={settings.defaultLocale}
          />
          <p className="text-sm text-muted-foreground">
            {t("settings.storefront.languagesSwitchHint")}
          </p>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        {saved.enabledLocales.includes("am") ? (
          <Button asChild className="w-full sm:w-auto" size="sm" variant="outline">
            <Link href={dashboardRoutes.storefrontTranslations}>
              <RiTranslate2 data-icon="inline-start" />
              {t("settings.storefront.languagesTranslate")}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          {dirty ? (
            <span className="text-xs font-medium text-warning-foreground">
              {t("common.unsaved.eyebrow")}
            </span>
          ) : null}
          <Button
            className="w-full rounded-full sm:w-auto"
            disabled={!dirty || pending}
            onClick={save}
            size="sm"
          >
            {pending
              ? t("settings.storefront.languagesSaving")
              : t("settings.storefront.languagesSave")}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        cancelLabel={t("settings.storefront.languagesNotNow")}
        confirmLabel={
          languageChange === "enable"
            ? t("settings.storefront.languagesEnable")
            : t("settings.storefront.languagesDisable")
        }
        description={
          languageChange === "enable"
            ? t("settings.storefront.languagesEnableDescription")
            : t("settings.storefront.languagesDisableDescription")
        }
        icon="question"
        onConfirm={() => {
          setAmharicEnabled(languageChange === "enable");
          setLanguageChange(null);
        }}
        onOpenChange={(open) => !open && setLanguageChange(null)}
        open={languageChange !== null}
        title={
          languageChange === "enable"
            ? t("settings.storefront.languagesEnableTitle")
            : t("settings.storefront.languagesDisableTitle")
        }
        tone="default"
      />
      <ConfirmDialog
        cancelLabel={t("settings.storefront.languagesNotNow")}
        confirmLabel={t("settings.storefront.languagesDefaultConfirm")}
        description={t("settings.storefront.languagesDefaultDescription", {
          language: defaultChange === "am" ? "አማርኛ" : t("settings.storefront.languagesEnglish"),
        })}
        icon="question"
        onConfirm={() => {
          if (defaultChange) {
            setSettings((current) => ({ ...current, defaultLocale: defaultChange }));
          }
          setDefaultChange(null);
        }}
        onOpenChange={(open) => !open && setDefaultChange(null)}
        open={defaultChange !== null}
        title={t("settings.storefront.languagesDefaultTitle")}
        tone="default"
      />
    </SettingsPanel>
  );
}
