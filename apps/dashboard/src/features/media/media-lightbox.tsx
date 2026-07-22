"use client";

import { useEffect, useId, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import type { MediaAsset } from "@/lib/merchant-media";
import { cn } from "@/lib/utils";
import { formatBytes, formatMimeLabel, mediaAssetDimensionsLabel } from "./media-helpers";

/** Above dialog/sheet (z-50) and their tooltips (z-50). */
const LIGHTBOX_Z = "z-[200]";
const LIGHTBOX_TOOLTIP_Z = "z-[210]";

type LightboxItem = {
  altText?: string | null;
  displayName: string;
  id: string;
  publicUrl: string;
  subtitle?: string | null;
};

export function MediaLightbox({
  assets,
  index,
  onClose,
  onIndexChange,
}: {
  assets: MediaAsset[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const items = assets
    .filter((asset): asset is MediaAsset & { publicUrl: string } => Boolean(asset.publicUrl))
    .map((asset) => ({
      altText: asset.altText,
      displayName: asset.displayName,
      id: asset.id,
      publicUrl: asset.publicUrl,
      subtitle: [
        mediaAssetDimensionsLabel(asset),
        formatMimeLabel(asset.mimeType),
        formatBytes(asset.byteSize),
      ]
        .filter(Boolean)
        .join(" · "),
    }));

  return (
    <MediaPreviewLightbox
      index={index}
      items={items}
      onClose={onClose}
      onIndexChange={onIndexChange}
    />
  );
}

export function MediaPreviewLightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: LightboxItem[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const isOpen = index !== null && items.length > 0;
  // Keep last open frame so Dialog can animate out without flashing empty.
  const [snapshot, setSnapshot] = useState<{ index: number; items: LightboxItem[] } | null>(null);

  useEffect(() => {
    if (isOpen && index !== null) {
      setSnapshot({ index, items });
      return;
    }

    const timer = window.setTimeout(() => setSnapshot(null), 220);
    return () => window.clearTimeout(timer);
  }, [index, isOpen, items]);

  if (!snapshot || !snapshot.items.length) return null;

  const safeIndex = Math.min(
    Math.max(isOpen && index !== null ? index : snapshot.index, 0),
    snapshot.items.length - 1,
  );
  const current = snapshot.items[safeIndex];
  if (!current) return null;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={isOpen}
    >
      <DialogContent
        className={cn(
          LIGHTBOX_Z,
          // Not full-bleed content: leave the overlay as the real dismiss surface
          // so outside-click / scrim close works through the shared dismiss stack.
          "fixed inset-0 top-0 left-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0",
          "flex-col gap-0 rounded-none border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-none",
          "data-open:zoom-in-100 data-closed:zoom-out-100",
        )}
        data-media-lightbox=""
        onOpenAutoFocus={(event) => event.preventDefault()}
        overlayClassName={cn(LIGHTBOX_Z, "bg-background/92 supports-backdrop-filter:backdrop-blur-[2px]")}
        showCloseButton={false}
      >
        <LightboxChrome
          current={current}
          index={safeIndex}
          onClose={onClose}
          onIndexChange={onIndexChange}
          total={snapshot.items.length}
        />
      </DialogContent>
    </Dialog>
  );
}

function LightboxChrome({
  current,
  index,
  onClose,
  onIndexChange,
  total,
}: {
  current: LightboxItem;
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  total: number;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const canNavigate = total > 1;
  const hasUrl = Boolean(current.publicUrl);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (!canNavigate) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        onIndexChange((index - 1 + total) % total);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        onIndexChange((index + 1) % total);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [canNavigate, index, onClose, onIndexChange, total]);

  return (
    <div className="flex h-full min-h-0 flex-col text-foreground" role="document">
      <DialogTitle className="sr-only" id={titleId}>
        {current.displayName}
      </DialogTitle>
      <DialogDescription className="sr-only">{t("media.lightboxLabel")}</DialogDescription>

      <div className="flex items-center justify-between gap-3 border-b border-border/80 bg-card/90 px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{current.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {current.subtitle ?? t("media.lightboxLabel")}
            {total > 1 ? ` · ${index + 1} / ${total}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <LightboxIconButton
            disabled={!hasUrl}
            {...(hasUrl ? { href: current.publicUrl } : {})}
            label={hasUrl ? t("media.openInNewTab") : t("media.lightboxOpenUnavailable")}
          >
            <AppIcons.externalLink />
          </LightboxIconButton>
          <LightboxIconButton label={t("media.lightboxClose")} onClick={onClose}>
            <AppIcons.close />
          </LightboxIconButton>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 md:p-8">
        <LightboxNavButton
          disabled={!canNavigate}
          label={canNavigate ? t("media.lightboxPrevious") : t("media.lightboxNavUnavailable")}
          onClick={() => canNavigate && onIndexChange((index - 1 + total) % total)}
          side="left"
          tooltipSide="right"
        >
          <AppIcons.arrowLeft />
        </LightboxNavButton>

        <button
          aria-label={t("media.lightboxClose")}
          className="absolute inset-0 cursor-zoom-out bg-muted/20"
          onClick={onClose}
          type="button"
        />

        <div
          className="relative z-[1] flex max-h-full max-w-full items-center justify-center"
          key={current.id}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {hasUrl ? (
            // biome-ignore lint/performance/noImgElement: Runtime object-storage media preview.
            <img
              alt={current.altText ?? current.displayName}
              className={cn(
                "max-h-[min(80vh,52rem)] max-w-full rounded-xl object-contain",
                "bg-card shadow-lg ring-1 ring-border",
              )}
              src={current.publicUrl}
            />
          ) : (
            <div className="flex max-w-sm flex-col items-center gap-2 rounded-xl border bg-card px-6 py-10 text-center shadow-lg">
              <AppIcons.image className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">{current.displayName}</p>
              <p className="text-xs text-muted-foreground">{t("media.lightboxOpenUnavailable")}</p>
            </div>
          )}
        </div>

        <LightboxNavButton
          disabled={!canNavigate}
          label={canNavigate ? t("media.lightboxNext") : t("media.lightboxNavUnavailable")}
          onClick={() => canNavigate && onIndexChange((index + 1) % total)}
          side="right"
          tooltipSide="left"
        >
          <AppIcons.arrowRight />
        </LightboxNavButton>
      </div>
    </div>
  );
}

function LightboxNavButton({
  children,
  disabled,
  label,
  onClick,
  side,
  tooltipSide,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  side: "left" | "right";
  tooltipSide: "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "absolute z-10 inline-flex",
            side === "left" ? "left-3 md:left-6" : "right-3 md:right-6",
            disabled && "cursor-not-allowed",
          )}
        >
          <Button
            aria-label={label}
            className={cn("rounded-full", disabled && "opacity-40")}
            disabled={disabled}
            onClick={onClick}
            size="icon"
            type="button"
            variant="outline"
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className={LIGHTBOX_TOOLTIP_Z} side={tooltipSide}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function LightboxIconButton({
  children,
  disabled,
  href,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  href?: string;
  label: string;
  onClick?: () => void;
}) {
  const button =
    href && !disabled ? (
      <Button asChild size="icon-sm" variant="ghost">
        <a aria-label={label} href={href} rel="noreferrer" target="_blank">
          {children}
        </a>
      </Button>
    ) : (
      <Button
        aria-label={label}
        className={cn(disabled && "opacity-40")}
        disabled={disabled}
        onClick={onClick}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {children}
      </Button>
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex", disabled && "cursor-not-allowed")}>{button}</span>
      </TooltipTrigger>
      <TooltipContent className={LIGHTBOX_TOOLTIP_Z} side="bottom">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
