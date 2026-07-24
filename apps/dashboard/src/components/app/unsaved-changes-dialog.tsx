"use client";

import { ConfirmDialog } from "@/components/app/confirm-dialog";
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

/** Leave confirmation for dirty forms — premium ConfirmDialog shell. */
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
    <ConfirmDialog
      cancelLabel={stayLabel ?? t("common.unsaved.stay")}
      confirmLabel={leaveLabel ?? t("common.unsaved.leave")}
      description={description ?? t("common.unsaved.description")}
      eyebrow={t("common.unsaved.eyebrow")}
      onConfirm={() => onLeave()}
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
      open={open}
      title={title ?? t("common.unsaved.title")}
      tone="destructive"
    />
  );
}
