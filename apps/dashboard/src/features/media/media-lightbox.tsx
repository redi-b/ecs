"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import type { MediaAsset } from "@/lib/merchant-media";
import { cn } from "@/lib/utils";
import { formatBytes, formatMimeLabel, mediaAssetDimensionsLabel } from "./media-helpers";

const EXIT_MS = 200;

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
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [active, setActive] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [snapshot, setSnapshot] = useState<{ index: number; items: LightboxItem[] } | null>(null);
  const exitTimer = useRef<number | null>(null);

  const isOpen = index !== null && items.length > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep content current while open (does not re-trigger enter animation).
  useEffect(() => {
    if (isOpen && index !== null) {
      setSnapshot({ index, items });
    }
  }, [index, isOpen, items]);

  // Enter / exit animation for the whole lightbox shell.
  useEffect(() => {
    if (exitTimer.current !== null) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }

    if (isOpen) {
      setExiting(false);
      setRendered(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setActive(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setActive(false);
    setExiting(true);
    exitTimer.current = window.setTimeout(() => {
      setRendered(false);
      setExiting(false);
      setSnapshot(null);
      exitTimer.current = null;
    }, EXIT_MS);

    return () => {
      if (exitTimer.current !== null) {
        window.clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
    };
  }, [isOpen]);

  if (!mounted || !rendered || !snapshot || !snapshot.items.length) return null;

  const safeIndex = Math.min(Math.max(snapshot.index, 0), snapshot.items.length - 1);
  const current = snapshot.items[safeIndex];
  if (!current) return null;

  return createPortal(
    <LightboxChrome
      active={active}
      current={current}
      exiting={exiting}
      index={safeIndex}
      onClose={onClose}
      onIndexChange={onIndexChange}
      total={snapshot.items.length}
    />,
    document.body,
  );
}

function motionClass(active: boolean, exiting: boolean, enter: string, exit: string) {
  if (active) return enter;
  if (exiting) return exit;
  return "opacity-0";
}

function LightboxChrome({
  active,
  current,
  exiting,
  index,
  onClose,
  onIndexChange,
  total,
}: {
  active: boolean;
  current: LightboxItem;
  exiting: boolean;
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  total: number;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const canNavigate = total > 1;

  useEffect(() => {
    if (!active) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

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
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [active, canNavigate, index, onClose, onIndexChange, total]);

  return (
    <div
      aria-hidden={!active}
      aria-labelledby={titleId}
      aria-modal="true"
      className={cn(
        "fixed inset-0 z-[100] flex flex-col bg-background/92 text-foreground",
        "supports-backdrop-filter:backdrop-blur-[2px]",
        "duration-200 ease-out fill-mode-forwards",
        motionClass(
          active,
          exiting,
          "animate-in fade-in-0",
          "pointer-events-none animate-out fade-out-0",
        ),
      )}
      data-media-lightbox=""
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b border-border/80 bg-card/90 px-4 py-3 shadow-sm",
          "duration-200 ease-out fill-mode-forwards",
          motionClass(
            active,
            exiting,
            "animate-in fade-in-0 slide-in-from-top-2",
            "animate-out fade-out-0 slide-out-to-top-2",
          ),
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" id={titleId}>
            {current.displayName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {current.subtitle ?? t("media.lightboxLabel")}
            {total > 1 ? ` · ${index + 1} / ${total}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {current.publicUrl ? (
            <Button asChild size="icon-sm" variant="ghost">
              <a
                aria-label={t("media.openInNewTab")}
                href={current.publicUrl}
                rel="noreferrer"
                target="_blank"
              >
                <AppIcons.externalLink />
              </a>
            </Button>
          ) : null}
          <Button
            aria-label={t("media.lightboxClose")}
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <AppIcons.close />
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 md:p-8">
        {canNavigate ? (
          <Button
            aria-label={t("media.lightboxPrevious")}
            className={cn(
              "absolute left-3 z-10 rounded-full md:left-6",
              "duration-200 ease-out fill-mode-forwards",
              motionClass(
                active,
                exiting,
                "animate-in fade-in-0 slide-in-from-left-2",
                "animate-out fade-out-0 slide-out-to-left-2",
              ),
            )}
            onClick={() => onIndexChange((index - 1 + total) % total)}
            size="icon"
            type="button"
            variant="outline"
          >
            <AppIcons.arrowLeft />
          </Button>
        ) : null}

        <button
          aria-label={t("media.lightboxClose")}
          className="absolute inset-0 cursor-zoom-out bg-muted/30"
          onClick={onClose}
          type="button"
        />

        <div
          className={cn(
            "relative z-[1] flex max-h-full max-w-full items-center justify-center",
            "duration-200 ease-out fill-mode-forwards",
            // Image crossfade/zoom on open/close of the shell; key remounts soft-enter on nav.
            motionClass(
              active,
              exiting,
              "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1",
              "animate-out fade-out-0 zoom-out-95 slide-out-to-bottom-1",
            ),
          )}
          key={current.id}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {/* biome-ignore lint/performance/noImgElement: Runtime object-storage media preview. */}
          <img
            alt={current.altText ?? current.displayName}
            className={cn(
              "max-h-[min(80vh,52rem)] max-w-full rounded-xl object-contain",
              "bg-card shadow-lg ring-1 ring-border",
            )}
            src={current.publicUrl}
          />
        </div>

        {canNavigate ? (
          <Button
            aria-label={t("media.lightboxNext")}
            className={cn(
              "absolute right-3 z-10 rounded-full md:right-6",
              "duration-200 ease-out fill-mode-forwards",
              motionClass(
                active,
                exiting,
                "animate-in fade-in-0 slide-in-from-right-2",
                "animate-out fade-out-0 slide-out-to-right-2",
              ),
            )}
            onClick={() => onIndexChange((index + 1) % total)}
            size="icon"
            type="button"
            variant="outline"
          >
            <AppIcons.arrowRight />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
