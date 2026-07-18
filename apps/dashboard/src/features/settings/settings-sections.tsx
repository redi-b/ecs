"use client";

import type { StorefrontTemplateCatalogItem } from "@ecs/contracts";
import { CheckIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTemplateTags } from "@/features/settings/settings-helpers";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

export function SettingsLinkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <a
        className="inline-flex min-w-0 items-center gap-1 font-medium hover:text-primary"
        href={`//${value}`}
        rel="noreferrer"
        target="_blank"
      >
        <span className="truncate">{value}</span>
        <ExternalLinkIcon className="size-3 shrink-0" aria-hidden="true" />
      </a>
    </div>
  );
}

export function StorefrontTemplateOption({
  currentTemplateKey,
  onSelected,
  template,
  tenantId,
}: {
  currentTemplateKey: string | null;
  onSelected?: (templateKey: string) => void;
  template: StorefrontTemplateCatalogItem;
  tenantId: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimisticKey, setOptimisticKey] = useState<string | null>(null);
  const selectedKey = optimisticKey ?? currentTemplateKey;
  const selected = selectedKey === template.version.templateKey;
  const tags = getTemplateTags(template);
  const features = getTemplateFeaturePills(template);

  async function selectTemplate() {
    if (selected || pending) return;

    setOptimisticKey(template.version.templateKey);

    try {
      const response = await fetch(dashboardRoutes.storefrontTemplate, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tenantId,
          templateKey: template.version.templateKey,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        setOptimisticKey(null);
        toast.error(data?.message?.replaceAll("_", " ") || t("settings.storefront.selectFailed"));
        return;
      }

      toast.success(t("settings.status.templateSelected"));
      onSelected?.(template.version.templateKey);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setOptimisticKey(null);
      toast.error(t("settings.storefront.selectFailed"));
    }
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-[border-color,box-shadow] duration-200",
        selected
          ? "border-primary ring-2 ring-primary/15"
          : "border-border hover:border-primary/40 hover:shadow-md",
      )}
    >
      <StorefrontTemplatePreview selected={selected} template={template} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold">{template.name}</p>
              {selected ? (
                <Badge className="gap-1" variant="secondary">
                  <CheckIcon className="size-3" aria-hidden />
                  {t("settings.storefront.selected")}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {template.description}
            </p>
          </div>
        </div>

        {features.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {features.map((feature) => (
              <li
                className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                key={feature}
              >
                {feature}
              </li>
            ))}
          </ul>
        ) : tags.length ? (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-1 sm:flex-row">
          <Button
            className="flex-1 rounded-full"
            disabled={selected || pending}
            onClick={() => void selectTemplate()}
            type="button"
            variant={selected ? "secondary" : "default"}
          >
            {pending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" data-icon="inline-start" />
                {t("settings.storefront.selecting")}
              </>
            ) : selected ? (
              t("settings.storefront.selected")
            ) : (
              t("settings.storefront.useThis")
            )}
          </Button>
          {selected ? (
            <Button asChild className="rounded-full sm:flex-none" type="button" variant="outline">
              <a href={dashboardRoutes.editor}>{t("settings.storefront.editStorefront")}</a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getTemplateFeaturePills(template: StorefrontTemplateCatalogItem) {
  const key = template.version.templateKey;
  if (key.startsWith("classic")) {
    return ["Collections", "Filters", "Variants", "Checkout"];
  }
  return [];
}

export function StorefrontTemplatePreview({
  selected,
  template,
}: {
  selected?: boolean;
  template: StorefrontTemplateCatalogItem;
}) {
  const { t } = useI18n();
  const isClassic = template.version.templateKey.startsWith("classic");

  // Match live classic light-brand look merchants already use in the editor.
  const palette = isClassic
    ? {
        bg: "#f6f1ea",
        fg: "#1c1917",
        primary: "#0f3d2e",
        muted: "#ebe4d8",
        bar: "#0f3d2e",
      }
    : {
        bg: "#0b0f0d",
        fg: "#e6ebe4",
        primary: "#9bc4a0",
        muted: "#141a16",
        bar: "#9bc4a0",
      };

  return (
    <div
      className={cn(
        "relative aspect-[16/10] overflow-hidden border-b",
        selected ? "border-primary/20" : "border-border",
      )}
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      <div
        className="px-3 py-1.5 text-center text-[9px] font-semibold tracking-wide"
        style={{ backgroundColor: palette.bar, color: isClassic ? "#f6f1ea" : "#0b0f0d" }}
      >
        Free local pickup · Cash on delivery
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="grid size-5 place-items-center rounded-md text-[10px] font-bold text-white"
            style={{ backgroundColor: palette.primary }}
          >
            {template.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-[11px] font-semibold tracking-tight">{template.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium opacity-70">Shop</span>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
            style={{ backgroundColor: palette.muted }}
          >
            Cart
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[1.1fr_0.9fr] items-center gap-3 px-3 pb-3 pt-1">
        <div className="flex flex-col gap-1.5">
          <span
            className="text-[13px] font-bold leading-tight tracking-tight"
            style={{ fontFamily: "Syne, ui-sans-serif, system-ui, sans-serif" }}
          >
            Crafted for everyday commerce
          </span>
          <span className="text-[9px] leading-snug opacity-60">
            Browse, add to cart, checkout with delivery or pickup.
          </span>
          <span
            className="mt-1 inline-flex h-5 w-fit items-center rounded-full px-2 text-[9px] font-semibold"
            style={{
              backgroundColor: palette.primary,
              color: isClassic ? "#f6f1ea" : "#0b0f0d",
            }}
          >
            Browse the shop
          </span>
        </div>
        <div
          className="aspect-[4/5] rounded-lg border"
          style={{
            borderColor: "color-mix(in srgb, currentColor 12%, transparent)",
            background: `linear-gradient(145deg, ${palette.muted}, color-mix(in srgb, ${palette.primary} 18%, ${palette.bg}))`,
          }}
        />
      </div>
      <span className="sr-only">{t("settings.storefront.preview", { name: template.name })}</span>
    </div>
  );
}
