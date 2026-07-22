"use client";

import type { StorefrontTemplateCatalogItem } from "@ecs/contracts";
import { CheckIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const palette = templatePreviewPalette(template.version.templateKey);

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
        "flex items-center gap-4 rounded-xl border bg-card p-3.5 shadow-sm transition-[border-color,box-shadow] duration-200",
        selected
          ? "border-primary/40 ring-1 ring-primary/15"
          : "border-border hover:border-primary/30 hover:shadow-md",
      )}
    >
      <div
        aria-hidden
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border"
        style={{
          borderColor: "color-mix(in srgb, currentColor 8%, transparent)",
          background: `linear-gradient(145deg, ${palette.bg} 0%, ${palette.muted} 55%, ${palette.primary} 140%)`,
        }}
      >
        <div
          className="absolute inset-x-2 bottom-2 h-1.5 rounded-full opacity-90"
          style={{ backgroundColor: palette.primary }}
        />
        <div
          className="absolute left-2 top-2 size-2.5 rounded-full"
          style={{ backgroundColor: palette.accent ?? palette.primary }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold tracking-tight">{template.name}</p>
          {selected ? (
            <Badge className="gap-1 font-medium" variant="secondary">
              <CheckIcon className="size-3" aria-hidden />
              {t("settings.storefront.selected")}
            </Badge>
          ) : null}
        </div>
        {template.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {template.description}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {selected ? (
          <Button asChild className="rounded-full" size="sm" type="button">
            <a href={dashboardRoutes.editor}>{t("settings.storefront.editStorefront")}</a>
          </Button>
        ) : (
          <Button
            className="rounded-full"
            disabled={pending}
            onClick={() => void selectTemplate()}
            size="sm"
            type="button"
          >
            {pending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" data-icon="inline-start" />
                {t("settings.storefront.selecting")}
              </>
            ) : (
              t("settings.storefront.useThis")
            )}
          </Button>
        )}
      </div>
      <span className="sr-only">{t("settings.storefront.preview", { name: template.name })}</span>
    </div>
  );
}

function templatePreviewPalette(templateKey: string) {
  if (templateKey.startsWith("classic")) {
    return {
      bg: "#0b0f0d",
      muted: "#141a16",
      primary: "#9bc4a0",
      accent: "#d4785a",
    };
  }
  return {
    bg: "#f6f1ea",
    muted: "#ebe4d8",
    primary: "#0f3d2e",
    accent: "#0f3d2e",
  };
}

export function SectionIntro({ description, title }: { description: string; title: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
