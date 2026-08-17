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
type ConfirmIcon = "warning" | "trash" | "question" | "logout";

type ConfirmDialogProps = {
  title: ReactNode;
  description: ReactNode;
  eyebrow?: string;
  cancelLabel?: string;
  confirmLabel: ReactNode;
  onConfirm: (event: React.MouseEvent<HTMLButtonElement>) => void;
  tone?: ConfirmTone;
  icon?: ConfirmIcon;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  trigger?: ReactNode;
  className?: string;
};

const ICONS = {
  warning: AppIcons.error,
  trash: AppIcons.trash,
  question: AppIcons.question,
  logout: AppIcons.logout,
} as const;

export function ConfirmDialog({
  title,
  description,
  eyebrow,
  cancelLabel,
  confirmLabel,
  onConfirm,
  tone = "destructive",
  icon,
  open,
  onOpenChange,
  confirmDisabled,
  cancelDisabled,
  trigger,
  className,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const isDestructive = tone === "destructive";
  const Icon = ICONS[icon ?? (isDestructive ? "warning" : "question")];

  return (
    <AlertDialog
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent
        className={cn(
          "w-[min(22rem,calc(100vw-1.5rem))] gap-0 overflow-hidden p-0 sm:max-w-[22rem]",
          "rounded-2xl border border-border/80 bg-popover",
          "shadow-[0_1px_2px_rgb(0_0_0/0.06),0_16px_40px_-12px_rgb(0_0_0/0.28)]",
          "dark:border-border/60 dark:shadow-[0_1px_2px_rgb(0_0_0/0.45),0_20px_48px_-10px_rgb(0_0_0/0.72)]",
          className,
        )}
      >
        <div className="flex flex-col gap-3.5 px-5 pt-5 pb-4">
          <div className="flex items-start gap-3.5">
            <div
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-2xl ring-1 ring-inset",
                isDestructive
                  ? "bg-destructive/12 text-destructive ring-destructive/20 dark:bg-destructive/18 dark:text-[color-mix(in_oklch,var(--destructive)_90%,white)]"
                  : "bg-primary/10 text-primary ring-primary/20",
              )}
            >
              <Icon className="size-5" aria-hidden />
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

        <div className="grid grid-cols-2 gap-2 border-t border-border/60 bg-muted/25 px-3.5 py-3 dark:bg-muted/20">
          <AlertDialogCancel
            className="h-8 w-full rounded-full font-medium shadow-none"
            disabled={cancelDisabled}
            size="default"
          >
            {cancelLabel ?? t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-8 w-full rounded-full font-medium shadow-none"
            disabled={confirmDisabled}
            onClick={(event) => {
              onConfirm(event);
            }}
            size="default"
            variant={isDestructive ? "destructive-solid" : "default"}
          >
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
