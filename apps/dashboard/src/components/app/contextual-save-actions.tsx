"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function ContextualSaveActions({
  canSave = true,
  className,
  dirty,
  mode = "sticky",
  onDiscard,
  onSave,
  pending = false,
  saveLabel,
  savingLabel,
  submit = false,
}: {
  canSave?: boolean;
  className?: string;
  dirty: boolean;
  mode?: "floating" | "sticky";
  onDiscard: () => void;
  onSave?: () => void;
  pending?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  submit?: boolean;
}) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!dirty) return null;

  const actions = (
    <section
      aria-label={t("common.unsaved.actionsLabel")}
      className={cn(
        "flex flex-col gap-3 border-border/70 bg-card/95 px-3 py-3 text-card-foreground backdrop-blur-md sm:flex-row sm:items-center sm:justify-between",
        mode === "sticky" &&
          "sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 -mx-3 -mb-3 mt-5 rounded-b-xl border-t shadow-[0_-8px_24px_-20px_rgb(0_0_0/0.45)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1",
        mode === "floating" &&
          "pointer-events-auto w-full max-w-xl rounded-2xl border shadow-2xl ring-1 ring-foreground/5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 sm:rounded-full sm:px-4 sm:py-2",
        className,
      )}
    >
      <output className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="size-1.5 rounded-full bg-warning-foreground" aria-hidden />
        {t("common.unsaved.actionsLabel")}
      </output>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <Button disabled={pending} onClick={onDiscard} size="sm" type="button" variant="ghost">
          {t("common.discard")}
        </Button>
        <Button
          className="rounded-full"
          disabled={!canSave || pending}
          onClick={submit ? undefined : onSave}
          size="sm"
          type={submit ? "submit" : "button"}
        >
          {pending ? (savingLabel ?? t("common.saving")) : (saveLabel ?? t("common.saveChanges"))}
        </Button>
      </div>
    </section>
  );

  if (mode === "floating") {
    if (!mounted) return null;
    return createPortal(
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        {actions}
      </div>,
      document.body,
    );
  }

  return actions;
}
