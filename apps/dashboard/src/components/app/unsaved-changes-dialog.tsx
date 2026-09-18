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
  changes?: readonly string[];
};

export function UnsavedChangesDialog({
  open,
  onStay,
  onLeave,
  title,
  description,
  stayLabel,
  leaveLabel,
  changes = [],
}: UnsavedChangesDialogProps) {
  const { t } = useI18n();

  return (
    <ConfirmDialog
      cancelLabel={stayLabel ?? t("common.unsaved.stay")}
      confirmLabel={leaveLabel ?? t("common.unsaved.leave")}
      description={description ?? t("common.unsaved.description")}
      details={
        changes.length ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-medium text-foreground">{t("common.unsaved.summary")}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {changes.join(" · ")}
            </p>
          </div>
        ) : null
      }
      eyebrow={t("common.unsaved.eyebrow")}
      icon="warning"
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
