"use client";

import { catalogTranslationResourceSchema, type CatalogTranslationResource } from "@ecs/contracts";
import { RiTranslate2 } from "@remixicon/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/provider";

export function ShippingTranslationField({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const [resource, setResource] = useState<CatalogTranslationResource | null>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({ locale: "am", resourceId: "default", resourceType: "shipping_option" });
    fetch(`/dashboard/storefront/translations/catalog?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        const parsed = catalogTranslationResourceSchema.safeParse(data?.resource);
        if (!response.ok || !parsed.success) throw new Error("load_failed");
        return parsed.data;
      })
      .then((loaded) => {
        if (!active) return;
        setResource(loaded);
        setValue(loaded.translations.name ?? "");
      })
      .catch(() => active && toast.error(t("settings.fulfillment.translationLoadFailed")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [enabled, t]);

  if (!enabled) return null;

  async function save() {
    if (!resource || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/dashboard/storefront/translations/catalog", {
        body: JSON.stringify({
          locale: "am",
          resourceId: resource.resourceId,
          resourceType: "shipping_option",
          translations: { name: value },
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      const data = await response.json().catch(() => null);
      const parsed = catalogTranslationResourceSchema.safeParse(data?.resource);
      if (!response.ok || !parsed.success) throw new Error("save_failed");
      setResource(parsed.data);
      toast.success(t("settings.fulfillment.translationSaved"));
    } catch {
      toast.error(t("settings.fulfillment.translationSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Field className="rounded-lg border border-border/70 bg-muted/10 p-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor="delivery-name-am" className="flex items-center gap-2">
          <RiTranslate2 className="size-4 text-primary" />
          {t("settings.fulfillment.translationLabel")}
        </FieldLabel>
        {resource ? <Badge variant="outline">{t(`products.translation.status.${resource.status}`)}</Badge> : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          disabled={loading || saving || !resource}
          id="delivery-name-am"
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("settings.fulfillment.translationPlaceholder")}
          value={value}
        />
        <Button disabled={loading || saving || !resource || value === (resource.translations.name ?? "")} onClick={save} size="sm" type="button">
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
      <FieldDescription>{t("settings.fulfillment.translationDescription", { source: resource?.source.name ?? t("settings.fulfillment.delivery.label") })}</FieldDescription>
    </Field>
  );
}
