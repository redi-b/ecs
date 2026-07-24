"use client";

import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type ConfirmTone = "destructive" | "default";

type ConfirmDialogProps = {
  title: ReactNode;
  description: ReactNode;
  /** Small uppercase label above the title (e.g. Unsaved, Delete). */
  eyebrow?: string;
  cancelLabel?: string;
  confirmLabel: ReactNode;
  onConfirm: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Soft primary vs solid danger confirm. Default destructive for safety. */
  tone?: ConfirmTone;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  /** Optional trigger (for uncontrolled / trigger-based confirms). */
  trigger?: ReactNode;
  className?: string;
};

/**
 * Premium confirmation shell shared by leave-unsaved, delete, pause, reset, etc.
 * AlertDialog for a11y; custom chrome (not stock media+footer).
 */
export function ConfirmDialog({
  title,
  description,
  eyebrow,
  cancelLabel,
  confirmLabel,
  onConfirm,
  tone = "destructive",
  open,
  onOpenChange,
  confirmDisabled,
  cancelDisabled,
  trigger,
  className,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const isDestructive = tone === "destructive";

  return (
    <AlertDialog
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent
        className={cn(
          "w-[min(22rem,calc(100vw-1.5rem))] gap-0 overflow-hidden p-0 sm:max-w-[22rem]",
          "rounded-2xl border-border/70 bg-popover shadow-[0_16px_40px_-12px_color-mix(in_oklch,var(--foreground)_28%,transparent)] ring-1 ring-foreground/[0.07]",
          className,
        )}
      >
        <div className="flex flex-col gap-4 px-5 pt-5 pb-4">
          <div className="flex items-start gap-3.5">
            <div
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-2xl ring-1 ring-inset",
                "shadow-[inset_0_1px_0_color-mix(in_oklch,var(--background)_55%,transparent)]",
                isDestructive
                  ? "bg-destructive/10 text-destructive ring-destructive/20"
                  : "bg-primary/10 text-primary ring-primary/20",
              )}
            >
              {isDestructive ? (
                <AppIcons.error className="size-5" aria-hidden />
              ) : (
                <AppIcons.question className="size-5" aria-hidden />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
              {eyebrow ? (
                <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <AlertDialogTitle className="text-[1.05rem] font-medium leading-snug tracking-tight text-foreground">
                {title}
              </AlertDialogTitle>
            </div>
          </div>

          <AlertDialogDescription className="text-sm leading-relaxed text-pretty text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border/60 bg-muted/30 px-4 py-3">
          <AlertDialogCancel
            className="h-9 w-full rounded-full font-medium shadow-none"
            disabled={cancelDisabled}
          >
            {cancelLabel ?? t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              "h-9 w-full rounded-full font-medium shadow-none",
              isDestructive &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/30",
            )}
            disabled={confirmDisabled}
            onClick={(event) => {
              event.preventDefault();
              onConfirm(event);
            }}
            variant={isDestructive ? "destructive" : "default"}
          >
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
