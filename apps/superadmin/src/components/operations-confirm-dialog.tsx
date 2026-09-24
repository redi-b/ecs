"use client";

import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

export function OperationsConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel,
  description,
  disabled,
  onConfirm,
  onOpenChange,
  open,
  pending,
  title,
  tone = "destructive",
  trigger,
}: {
  cancelLabel?: string;
  confirmLabel: ReactNode;
  description: ReactNode;
  disabled?: boolean;
  onConfirm: () => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  pending?: boolean;
  title: ReactNode;
  tone?: "default" | "destructive";
  trigger?: ReactNode;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled || pending}
            onClick={onConfirm}
            variant={tone === "destructive" ? "destructive-solid" : "default"}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
