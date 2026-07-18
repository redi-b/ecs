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

/** Compact live/paused pill shared by settings + can be reused. */
export function ShopLiveStatusBadge({ live }: { live: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        live
          ? "bg-emerald-600/12 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200"
          : "bg-amber-500/12 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          live ? "bg-emerald-600 dark:bg-emerald-400" : "bg-amber-600 dark:bg-amber-400",
        )}
        aria-hidden
      />
      {live ? t("settings.storefront.live") : t("settings.storefront.paused")}
    </span>
  );
}

export function StorefrontTemplateOption({
  currentTemplateKey,
  onSelected,
  template,
  tenantId,
  layout = "card",
}: {
  currentTemplateKey: string | null;
  onSelected?: (templateKey: string) => void;
  template: StorefrontTemplateCatalogItem;
  tenantId: string;
  /** card = stacked preview; compact = horizontal thumbnail (settings single-template). */
  layout?: "card" | "compact";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimisticKey, setOptimisticKey] = useState<string | null>(null);
  const selectedKey = optimisticKey ?? currentTemplateKey;
  const selected = selectedKey === template.version.templateKey;
  const tags = getTemplateTags(template);
  const features = getTemplateFeaturePills(template);
  const isCompact = layout === "compact";

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
        "group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-[border-color,box-shadow] duration-200",
        isCompact ? "flex flex-col sm:flex-row" : "flex flex-col",
        selected
          ? "border-primary ring-2 ring-primary/15"
          : "border-border hover:border-primary/40 hover:shadow-md",
      )}
    >
      <StorefrontTemplatePreview
        className={cn(
          isCompact
            ? "w-full shrink-0 border-b sm:w-44 sm:border-b-0 sm:border-r sm:self-stretch"
            : "w-full border-b",
        )}
        compact={isCompact}
        selected={selected}
        template={template}
      />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-3",
          isCompact ? "p-3.5 sm:p-4" : "p-4",
        )}
      >
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

        <p className="text-[11px] leading-snug text-muted-foreground">
          {t("settings.storefront.stylePreviewHint")}
        </p>

        <div className="mt-auto flex flex-col gap-2 pt-0.5 sm:flex-row">
          <Button
            className="flex-1 rounded-full"
            disabled={selected || pending}
            onClick={() => void selectTemplate()}
            size={isCompact ? "sm" : "default"}
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
            <Button
              asChild
              className="rounded-full sm:flex-none"
              size={isCompact ? "sm" : "default"}
              type="button"
              variant="outline"
            >
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

/**
 * Style thumbnail only (not merchant draft content).
 * Matches Classic default theme so settings does not drift from the editor shell.
 */
export function StorefrontTemplatePreview({
  className,
  compact = false,
  selected,
  template,
}: {
  className?: string;
  compact?: boolean;
  selected?: boolean;
  template: StorefrontTemplateCatalogItem;
}) {
  const { t } = useI18n();
  const isClassic = template.version.templateKey.startsWith("classic");

  // Classic default theme tokens (dark forest). Keep in sync with classicV1ThemeTokens.
  const palette = isClassic
    ? {
        bg: "#0b0f0d",
        fg: "#e6ebe4",
        primary: "#9bc4a0",
        muted: "#141a16",
        bar: "#9bc4a0",
        onPrimary: "#0b0f0d",
        onBar: "#0b0f0d",
      }
    : {
        bg: "#f6f1ea",
        fg: "#1c1917",
        primary: "#0f3d2e",
        muted: "#ebe4d8",
        bar: "#0f3d2e",
        onPrimary: "#f6f1ea",
        onBar: "#f6f1ea",
      };

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        compact ? "min-h-[8.5rem] sm:min-h-0 sm:h-auto" : "aspect-[16/10] max-h-44",
        selected ? "border-primary/20" : "border-border",
        className,
      )}
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      <div
        className={cn(
          "text-center font-semibold tracking-wide",
          compact ? "px-2 py-1 text-[8px]" : "px-2.5 py-1 text-[9px]",
        )}
        style={{ backgroundColor: palette.bar, color: palette.onBar }}
      >
        Local delivery and pickup
      </div>
      <div
        className={cn(
          "flex items-center justify-between gap-1.5",
          compact ? "px-2 py-1.5" : "px-2.5 py-2",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-md font-bold",
              compact ? "size-4 text-[8px]" : "size-5 text-[10px]",
            )}
            style={{ backgroundColor: palette.primary, color: palette.onPrimary }}
          >
            {template.name.slice(0, 1).toUpperCase()}
          </span>
          <span
            className={cn(
              "truncate font-semibold tracking-tight",
              compact ? "text-[10px]" : "text-[11px]",
            )}
          >
            {template.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={cn("font-medium opacity-70", compact ? "text-[8px]" : "text-[10px]")}>
            Shop
          </span>
          <span
            className={cn(
              "rounded-full font-semibold",
              compact ? "px-1.5 py-0.5 text-[7px]" : "px-2 py-0.5 text-[9px]",
            )}
            style={{ backgroundColor: palette.muted }}
          >
            Cart
          </span>
        </div>
      </div>
      <div
        className={cn(
          "grid grid-cols-[1.15fr_0.85fr] items-center",
          compact ? "gap-2 px-2 pb-2 pt-0.5" : "gap-2.5 px-2.5 pb-2.5 pt-0.5",
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span
            className={cn(
              "font-bold leading-tight tracking-tight",
              compact ? "text-[11px]" : "text-[12px]",
            )}
            style={{ fontFamily: "Syne, ui-sans-serif, system-ui, sans-serif" }}
          >
            Find something you love
          </span>
          <span
            className={cn("line-clamp-2 leading-snug opacity-60", compact ? "text-[7px]" : "text-[8px]")}
          >
            Browse new arrivals and check out with delivery or pickup.
          </span>
          <span
            className={cn(
              "mt-0.5 inline-flex w-fit items-center rounded-full font-semibold",
              compact ? "h-4 px-1.5 text-[7px]" : "h-5 px-2 text-[8px]",
            )}
            style={{
              backgroundColor: palette.primary,
              color: palette.onPrimary,
            }}
          >
            Shop now
          </span>
        </div>
        <div
          className={cn("rounded-md border", compact ? "aspect-[5/4]" : "aspect-[4/5]")}
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
