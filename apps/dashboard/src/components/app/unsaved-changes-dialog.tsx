"use client";

import { AppIcons } from "@/components/app/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/i18n/provider";

type UnsavedChangesDialogProps = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  title?: string;
  description?: string;
  stayLabel?: string;
  leaveLabel?: string;
};

/** Standard leave confirmation using shared AlertDialog primitives. */
export function UnsavedChangesDialog({
  open,
  onStay,
  onLeave,
  title,
  description,
  stayLabel,
  leaveLabel,
}: UnsavedChangesDialogProps) {
  const { t } = useI18n();

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
      open={open}
    >
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <AppIcons.error className="size-5" aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>{title ?? t("common.unsaved.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? t("common.unsaved.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>
            {stayLabel ?? t("common.unsaved.stay")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onLeave} variant="destructive">
            {leaveLabel ?? t("common.unsaved.leave")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
