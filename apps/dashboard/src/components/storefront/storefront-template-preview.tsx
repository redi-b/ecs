"use client";

import type { StorefrontTemplateCatalogItem } from "@ecs/contracts";
import { getStorefrontTemplateDefinition } from "@ecs/storefront-templates";
import { useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function StorefrontTemplatePreview({
  className,
  compact = false,
  demoLabel,
  previewLabel,
  template,
}: {
  className?: string;
  compact?: boolean;
  demoLabel: string;
  previewLabel: string;
  template: StorefrontTemplateCatalogItem;
}) {
  const [open, setOpen] = useState(false);
  const preview = template.version.previewUrl ?? null;
  const alt = template.version.previewAltText ?? `${template.name} storefront preview`;
  const fallbackPalette = getFallbackPalette(template.version.templateKey);

  return (
    <>
      <button
        aria-label={`${previewLabel}: ${template.name}`}
        className={cn("group block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        type="button"
      >
        <PreviewFrame alt={alt} compact={compact} fallbackPalette={fallbackPalette} name={template.name} preview={preview} slug={template.slug} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-5 py-4 text-left">
            <div className="flex items-start justify-between gap-4 pe-8">
              <div className="min-w-0">
                <DialogTitle>{template.name}</DialogTitle>
                <DialogDescription className="mt-1">{template.description}</DialogDescription>
              </div>
              {template.version.demoUrl ? (
                <Button asChild className="shrink-0" size="sm" variant="outline">
                  <a href={template.version.demoUrl} rel="noreferrer" target="_blank">
                    {demoLabel}
                    <AppIcons.externalLink aria-hidden data-icon="inline-end" />
                  </a>
                </Button>
              ) : null}
            </div>
          </DialogHeader>
          <div className="max-h-[72vh] overflow-auto bg-muted/30 p-3 sm:p-5">
            <PreviewFrame alt={alt} fallbackPalette={fallbackPalette} name={template.name} preview={preview} slug={template.slug} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PreviewFrame({ alt, compact = false, fallbackPalette, name, preview, slug }: {
  alt: string;
  compact?: boolean;
  fallbackPalette: FallbackPalette;
  name: string;
  preview: string | null;
  slug: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-muted/40", compact ? "aspect-[4/3]" : "aspect-[16/10]") }>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt} className="size-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.01] motion-reduce:transition-none" src={preview} />
      ) : (
        <FallbackPreview compact={compact} name={name} palette={fallbackPalette} slug={slug} />
      )}
      <span className="absolute inset-0 bg-foreground/0 transition-colors group-hover:bg-foreground/[0.025]" aria-hidden />
      <span className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full border bg-background/95 text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
        <AppIcons.expand className="size-3.5" />
      </span>
    </div>
  );
}

type FallbackPalette = { accent: string; background: string; foreground: string; muted: string; primary: string };

function FallbackPreview({ compact, name, palette, slug }: { compact: boolean; name: string; palette: FallbackPalette; slug: string }) {
  return (
    <div className="absolute inset-0" role="img" aria-label={`${name} storefront preview unavailable`} style={{ backgroundColor: palette.background, color: palette.foreground }}>
      <div className="absolute inset-x-2.5 top-2.5 flex items-center gap-1">
        <span className="size-1.5 rounded-full opacity-20" style={{ backgroundColor: palette.foreground }} />
        <span className="size-1.5 rounded-full opacity-20" style={{ backgroundColor: palette.foreground }} />
        <span className="size-1.5 rounded-full opacity-20" style={{ backgroundColor: palette.foreground }} />
        <span className="ml-1 h-1.5 flex-1 rounded-full opacity-10" style={{ backgroundColor: palette.foreground }} />
      </div>
      <div className="absolute inset-x-2.5 bottom-2.5 top-8 grid grid-cols-[1.2fr_0.8fr] gap-1.5">
        <div className="flex flex-col justify-end rounded-md p-2.5 shadow-sm" style={{ backgroundColor: palette.muted }}>
          <span className="block h-1.5 w-12 rounded-full opacity-35" style={{ backgroundColor: palette.foreground }} />
          <span className="mt-1.5 block h-1.5 w-16 rounded-full opacity-20" style={{ backgroundColor: palette.foreground }} />
          <span className="mt-2.5 block h-4 w-12 rounded-md" style={{ backgroundColor: palette.primary }} />
        </div>
        <div className="grid gap-1.5">
          <span className="rounded-md opacity-80" style={{ backgroundColor: palette.accent }} />
          <span className="rounded-md opacity-60" style={{ backgroundColor: palette.muted }} />
        </div>
      </div>
      {!compact ? <span className="absolute left-2.5 top-8 rounded-md bg-background/95 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{slug}</span> : null}
    </div>
  );
}

function getFallbackPalette(templateKey: string): FallbackPalette {
  const tokens = getStorefrontTemplateDefinition(templateKey)?.defaultThemeTokens;
  const colors = tokens && typeof tokens === "object" && "colors" in tokens
    ? (tokens.colors as Partial<FallbackPalette>)
    : null;
  return {
    accent: colors?.accent ?? "#dbe7f7",
    background: colors?.background ?? "#f7f9fc",
    foreground: colors?.foreground ?? "#1f2937",
    muted: colors?.muted ?? "#e8eef6",
    primary: colors?.primary ?? "#2563eb",
  };
}
