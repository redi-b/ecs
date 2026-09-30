"use client";

import type { ShopDetails } from "@ecs/contracts";
import { useId } from "react";
import { ContextualSaveActions } from "@/components/app/contextual-save-actions";
import { ColorPickerField } from "@/components/ui/color-picker-field";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MediaImageReferenceControl } from "@/features/media/media-image-reference-control";
import {
  SectionIntro,
  SettingsPanel,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";

const defaultBranding: NonNullable<ShopDetails["documentBranding"]> = {
  accentColor: "#18181b",
  footerNote: "",
  logoUrl: "",
  showContactDetails: true,
};
const presetColors: Record<NonNullable<ShopDetails["brand"]>["presetId"], string> = {
  amber: "#b45309",
  blue: "#2563eb",
  original: "#18181b",
  rose: "#be123c",
  teal: "#0f766e",
  violet: "#7c3aed",
};

export function DocumentBrandingFields({
  canSave,
  dirty,
  disabled,
  onChange,
  onDiscard,
  onSave,
  pending,
  shopName,
  value,
}: {
  canSave: boolean;
  dirty: boolean;
  disabled: boolean;
  onChange: (value: ShopDetails) => void;
  onDiscard: () => void;
  onSave: () => void;
  pending: boolean;
  shopName: string;
  value: ShopDetails;
}) {
  const { t } = useI18n();
  const footerId = useId();
  const branding = value.documentBranding ?? {
    ...defaultBranding,
    accentColor: value.brand?.customPrimary ?? presetColors[value.brand?.presetId ?? "original"],
  };
  const update = (next: Partial<typeof branding>) =>
    onChange({ ...value, documentBranding: { ...branding, ...next } });

  return (
    <SettingsSectionBody>
      <SectionIntro title={t("settings.sections.documents.label")} />
      <div className="w-full max-w-5xl">
        <SettingsPanel
          contentClassName="space-y-6"
          description={t("settings.documents.description")}
          title={t("settings.documents.title")}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
                <Field>
                  <FieldLabel>{t("settings.documents.logo")}</FieldLabel>
                  {disabled ? (
                    branding.logoUrl ? (
                      // biome-ignore lint/performance/noImgElement: User-selected public media is previewed at its source URL.
                      <img
                        alt=""
                        className="h-16 max-w-48 rounded-md border object-contain p-2"
                        src={branding.logoUrl}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("settings.documents.noLogo")}
                      </p>
                    )
                  ) : (
                    <MediaImageReferenceControl
                      hideLabel
                      label={t("settings.documents.logo")}
                      onChange={(logoUrl) => update({ logoUrl: logoUrl ?? "" })}
                      value={branding.logoUrl}
                    />
                  )}
                  <FieldDescription>{t("settings.documents.logoHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>{t("settings.documents.accent")}</FieldLabel>
                  {disabled ? (
                    <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
                      <span
                        className="size-4 rounded-full border"
                        style={{ backgroundColor: branding.accentColor }}
                      />
                      <span className="font-mono text-xs uppercase">{branding.accentColor}</span>
                    </div>
                  ) : (
                    <ColorPickerField
                      defaultColor="#18181b"
                      label={t("settings.documents.accent")}
                      onChange={(accentColor) => update({ accentColor })}
                      resetLabel={t("settings.documents.resetAccent")}
                      value={branding.accentColor}
                    />
                  )}
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={footerId}>{t("settings.documents.footerNote")}</FieldLabel>
                <Textarea
                  disabled={disabled}
                  id={footerId}
                  maxLength={240}
                  onChange={(event) => update({ footerNote: event.target.value })}
                  placeholder={t("settings.documents.footerPlaceholder")}
                  value={branding.footerNote}
                />
              </Field>
              <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3">
                <div>
                  <p className="text-sm font-medium">{t("settings.documents.showContact")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.documents.showContactHelp")}
                  </p>
                </div>
                <Switch
                  checked={branding.showContactDetails}
                  disabled={disabled}
                  onCheckedChange={(checked) => update({ showContactDetails: checked })}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("settings.documents.preview")}
              </p>
              <div className="rounded-lg border bg-background p-4 shadow-xs">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {branding.logoUrl ? (
                      // biome-ignore lint/performance/noImgElement: User-selected public media is previewed at its source URL.
                      <img
                        alt=""
                        className="mb-3 h-8 max-w-24 object-contain object-left"
                        src={branding.logoUrl}
                      />
                    ) : null}
                    <p className="truncate text-xs font-semibold">{shopName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold">Q-000001</p>
                    <div
                      className="ml-auto mt-2 w-8 border-t-2"
                      style={{ borderColor: branding.accentColor }}
                    />
                  </div>
                </div>
                <div className="mt-7 grid grid-cols-[minmax(0,1fr)_2rem_3.5rem] gap-2 border-b pb-2 text-[9px] font-medium text-muted-foreground">
                  <span>{t("settings.documents.previewItem")}</span>
                  <span className="text-right">{t("settings.documents.previewQty")}</span>
                  <span className="text-right">ETB</span>
                </div>
                {[
                  t("settings.documents.previewItemOne"),
                  t("settings.documents.previewItemTwo"),
                ].map((item, index) => (
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_2rem_3.5rem] gap-2 border-b py-2 text-[10px]"
                    key={item}
                  >
                    <span className="truncate">{item}</span>
                    <span className="text-right">1</span>
                    <span className="text-right tabular-nums">{index ? "850" : "1,200"}</span>
                  </div>
                ))}
                <div
                  className="ml-auto mt-3 flex w-36 justify-between border-t-2 pt-2 text-[10px] font-semibold"
                  style={{ borderColor: branding.accentColor }}
                >
                  <span>{t("settings.documents.previewTotal")}</span>
                  <span>2,050 ETB</span>
                </div>
                {branding.footerNote ? (
                  <p className="mt-6 border-t pt-2 text-[9px] text-muted-foreground">
                    {branding.footerNote}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          {!disabled ? (
            <ContextualSaveActions
              canSave={canSave}
              dirty={dirty}
              onDiscard={onDiscard}
              onSave={onSave}
              pending={pending}
              saveLabel={t("settings.documents.save")}
            />
          ) : null}
        </SettingsPanel>
      </div>
    </SettingsSectionBody>
  );
}
