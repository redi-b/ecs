"use client";

import { useId } from "react";
import type { ShopDetails } from "@ecs/contracts";
import { contrastingInk, getBrandPresets } from "@ecs/storefront-templates";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function ShopBrandPicker({ templateKey, shopName, value, onChange, disabled }: {
  templateKey: string;
  shopName: string;
  value: ShopDetails["brand"];
  onChange: (brand: NonNullable<ShopDetails["brand"]>) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const presets = getBrandPresets(templateKey);
  const selected = value?.presetId ?? "original";
  return <fieldset disabled={disabled} className="min-w-0 space-y-4">
    <legend className="text-sm font-semibold">{t("onboarding.brand.title")}</legend>
    <p className="text-sm text-muted-foreground">{t("onboarding.brand.help")}</p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t("onboarding.brand.title")}>
      {presets.map((preset) => <label key={preset.id} className={cn("relative cursor-pointer overflow-hidden rounded-xl border p-2 transition-colors focus-within:ring-2 focus-within:ring-ring", selected === preset.id && !value?.customPrimary ? "border-primary bg-primary/5" : "border-border hover:border-foreground/25")}>
        <input className="sr-only" type="radio" name={`${id}-palette`} checked={selected === preset.id} onChange={() => onChange({ presetId: preset.id })} />
        <div aria-hidden className="space-y-3 rounded-lg p-3" style={{ background: preset.colors.background, color: preset.colors.foreground }}>
          <p className="truncate text-xs font-semibold">{shopName.trim() || "Your shop"}</p>
          <div className="flex gap-1.5"><span className="h-5 flex-1 rounded" style={{ background: preset.colors.muted }} /><span className="h-5 flex-1 rounded" style={{ background: preset.colors.accent }} /></div>
          <span className="block rounded px-2 py-1 text-center text-[0.65rem] font-medium" style={{ background: preset.colors.primary, color: contrastingInk(preset.colors.primary) }}>{t("onboarding.brand.preview")}</span>
        </div>
        <span className="mt-2 block text-center text-xs font-medium">{t(`onboarding.brand.${preset.id}`)}</span>
      </label>)}
    </div>
    <p className="text-xs text-muted-foreground">{t("onboarding.brand.customLater")}</p>
  </fieldset>;
}
