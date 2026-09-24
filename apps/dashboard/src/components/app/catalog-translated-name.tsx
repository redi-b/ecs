"use client";

import type { CatalogNameTranslation } from "@ecs/contracts";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useCatalogLabelLocale } from "@/components/providers/catalog-label-locale-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/provider";
import { catalogDisplayName } from "@/lib/catalog-display-name";
import { cn } from "@/lib/utils";

const STATUS_MARK: Record<CatalogNameTranslation["status"], string> = {
  ready: "text-success",
  needs_review: "text-warning",
  using_english: "text-muted-foreground",
};

function canHoverOpen() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function isSheetOrDialogOpen() {
  return Boolean(
    document.querySelector(
      "[data-slot='sheet-overlay'], [data-slot='dialog-overlay'], [data-slot='alert-dialog-overlay']",
    ),
  );
}

export function CatalogTranslatedName({
  className,
  preview = "mark",
  renderName,
  source,
  translation,
  untitled,
}: {
  className?: string;
  preview?: "mark" | "name";
  renderName?: ((primary: string) => ReactNode) | undefined;
  source: string | null | undefined;
  translation?: CatalogNameTranslation | null | undefined;
  untitled: string;
}) {
  const { t } = useI18n();
  const { amharicEnabled, displayLocale } = useCatalogLabelLocale();
  const display = catalogDisplayName({
    displayLocale,
    source,
    translation,
    untitled,
  });
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number>(0);

  useEffect(() => {
    return () => window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!open) return;

    function close() {
      setOpen(false);
    }

    if (isSheetOrDialogOpen()) {
      close();
      return;
    }

    const observer = new MutationObserver(() => {
      if (isSheetOrDialogOpen()) close();
    });
    observer.observe(document.body, {
      attributeFilter: ["data-state", "data-slot"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [open]);

  function openIfHover() {
    if (!canHoverOpen()) return;
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function closeIfHover() {
    if (!canHoverOpen()) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  const name = renderName ? (
    renderName(display.primary)
  ) : (
    <span className={cn("min-w-0 truncate", className)} lang={displayLocale === "am" ? "am" : "en"}>
      {display.primary}
    </span>
  );

  if (!amharicEnabled) {
    return <span className="min-w-0">{name}</span>;
  }

  const body = (
    <>
      {display.other ? (
        <p
          className="text-pretty text-sm font-medium"
          lang={display.otherLang === "am" ? "am" : "en"}
        >
          {display.other}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("catalogLabels.mark.empty")}</p>
      )}
      {display.status === "needs_review" ? (
        <p className="text-xs text-warning">{t("catalogLabels.mark.needs_review")}</p>
      ) : null}
    </>
  );

  const markLabel = display.otherLang === "am" ? "አማ" : "EN";

  const popover = (
    <Popover onOpenChange={setOpen} open={open}>
      <span onPointerEnter={openIfHover} onPointerLeave={closeIfHover}>
        <PopoverTrigger asChild>
          {preview === "name" ? (
            name
          ) : (
            <button
              aria-label={t("catalogLabels.mark.open")}
              className={cn(
                "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold leading-none",
                STATUS_MARK[display.status],
              )}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              <span aria-hidden>{markLabel}</span>
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56"
          onClick={(event) => event.stopPropagation()}
          onPointerEnter={openIfHover}
          onPointerLeave={closeIfHover}
        >
          {body}
        </PopoverContent>
      </span>
    </Popover>
  );

  if (preview === "name") {
    return <span className="min-w-0">{popover}</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="min-w-0" onPointerDown={() => setOpen(false)}>
        {name}
      </span>
      {popover}
    </span>
  );
}
