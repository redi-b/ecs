"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ProductColorPopover } from "@/features/products/product-form-sections";
import { useI18n } from "@/i18n/provider";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";

type SavedValue = { label: string; swatch?: { kind: "color"; value: string } | null };
type SavedOption = { id: string; title: string; values: SavedValue[] };
type SavedOptionDraft = SavedOption & { isNew?: boolean };

export function SavedProductOptionsManager({ tenantId }: { tenantId: string | null }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const url = getTenantScopedPath("/admin/products/actions/option-sets", tenantId);
  const [editing, setEditing] = useState<SavedOptionDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedOption | null>(null);
  const query = useQuery({
    queryKey: ["product-option-sets", tenantId],
    queryFn: async () => {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("load_failed");
      return (await response.json()) as { optionSets: SavedOption[] };
    },
  });
  const save = useMutation({
    mutationFn: async (option: SavedOptionDraft) => {
      const target = option.isNew
        ? "/admin/products/actions/option-sets"
        : `/admin/products/actions/option-sets/${encodeURIComponent(option.id)}`;
      const response = await fetch(getTenantScopedPath(target, tenantId), {
        body: JSON.stringify({ title: option.title, values: option.values }),
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "save_failed");
    },
    onSuccess: async (_data, option) => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["product-option-sets", tenantId] });
      toast.success(
        option.isNew ? t("products.savedOptions.created") : t("products.savedOptions.updated"),
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error && error.message === "product_option_set_title_taken"
          ? t("products.savedOptions.nameTaken")
          : t("products.savedOptions.saveFailed"),
      ),
  });
  const remove = useMutation({
    mutationFn: async (option: SavedOption) => {
      const response = await fetch(
        getTenantScopedPath(
          `/admin/products/actions/option-sets/${encodeURIComponent(option.id)}`,
          tenantId,
        ),
        { headers: { accept: "application/json" }, method: "DELETE" },
      );
      if (!response.ok) throw new Error("delete_failed");
    },
    onSuccess: async () => {
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["product-option-sets", tenantId] });
      toast.success(t("products.savedOptions.deleted"));
    },
    onError: () => toast.error(t("products.savedOptions.deleteFailed")),
  });

  if (query.isPending) {
    return <div className="h-48 animate-pulse rounded-2xl border bg-muted/20" />;
  }
  if (query.isError) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border px-5 text-center">
        <p className="text-sm text-muted-foreground">{t("products.savedOptions.loadFailed")}</p>
        <Button onClick={() => void query.refetch()} size="sm" variant="outline">
          {t("common.tryAgain")}
        </Button>
      </div>
    );
  }
  const options = query.data.optionSets;
  const startCreating = () => setEditing({ id: "", isNew: true, title: "", values: [] });
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("products.savedOptions.count", { count: options.length })}
        </p>
        <Button onClick={startCreating} size="sm">
          <AppIcons.add data-icon="inline-start" />
          {t("products.savedOptions.newAction")}
        </Button>
      </div>
      {options.length ? (
        <div className="divide-y overflow-hidden rounded-2xl border bg-background">
          {options.map((option) => (
            <div className="flex items-center gap-3 px-4 py-3" key={option.id}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{option.title}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {option.values.map((value) => (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-1 text-xs"
                      key={value.label}
                    >
                      {value.swatch ? (
                        <span
                          className="size-2.5 rounded-full border"
                          style={{ backgroundColor: value.swatch.value }}
                        />
                      ) : null}
                      {value.label}
                    </span>
                  ))}
                </div>
              </div>
              <Button
                onClick={() =>
                  setEditing({
                    ...option,
                    values: option.values.map((value) =>
                      value.swatch
                        ? { ...value, swatch: { ...value.swatch } }
                        : { label: value.label },
                    ),
                  })
                }
                size="sm"
                variant="ghost"
              >
                <AppIcons.edit data-icon="inline-start" />
                {t("common.edit")}
              </Button>
              <Button
                aria-label={t("products.savedOptions.deleteAria", { name: option.title })}
                onClick={() => setPendingDelete(option)}
                size="icon-sm"
                variant="ghost"
              >
                <AppIcons.trash />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed px-5 text-center">
          <AppIcons.tag className="mb-3 size-5 text-muted-foreground" />
          <p className="text-sm font-medium">{t("products.savedOptions.emptyTitle")}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t("products.savedOptions.emptyDescription")}
          </p>
          <Button className="mt-4" onClick={startCreating} size="sm">
            <AppIcons.add data-icon="inline-start" />
            {t("products.savedOptions.newAction")}
          </Button>
        </div>
      )}
      <SavedOptionEditDialog
        key={editing ? (editing.isNew ? "new" : editing.id) : "closed"}
        onChange={setEditing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={(option) => save.mutate(option)}
        option={editing}
        saving={save.isPending}
      />
      <ConfirmDialog
        confirmDisabled={remove.isPending}
        confirmLabel={remove.isPending ? t("common.deleting") : t("common.delete")}
        description={t("products.savedOptions.deleteDescription")}
        icon="trash"
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        open={Boolean(pendingDelete)}
        title={t("products.savedOptions.deleteTitle")}
      />
    </>
  );
}

function SavedOptionEditDialog({
  onChange,
  onOpenChange,
  onSave,
  option,
  saving,
}: {
  onChange: (option: SavedOptionDraft) => void;
  onOpenChange: (open: boolean) => void;
  onSave: (option: SavedOptionDraft) => void;
  option: SavedOptionDraft | null;
  saving: boolean;
}) {
  const { t } = useI18n();
  const [draftValue, setDraftValue] = useState("");
  if (!option) return null;
  const currentOption = option;
  const isColor = /^(colou?r)$/i.test(currentOption.title.trim());
  const update = (patch: Partial<SavedOptionDraft>) => onChange({ ...currentOption, ...patch });
  function addValue(label: string, swatch?: SavedValue["swatch"]) {
    const next = label.trim();
    if (
      !next ||
      currentOption.values.some((value) => value.label.toLowerCase() === next.toLowerCase())
    )
      return;
    update({
      values: [...currentOption.values, { label: next, ...(swatch ? { swatch } : {}) }],
    });
    setDraftValue("");
  }
  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="max-w-lg">
        <DialogTitle>
          {option.isNew
            ? t("products.savedOptions.createTitle")
            : t("products.savedOptions.editTitle")}
        </DialogTitle>
        <DialogDescription>
          {option.isNew
            ? t("products.savedOptions.createDescription")
            : t("products.savedOptions.editDescription")}
        </DialogDescription>
        <div className="grid gap-4 py-2">
          <Field>
            <FieldLabel>{t("products.formReview.optionName")}</FieldLabel>
            <Input
              onChange={(event) => update({ title: event.target.value })}
              value={option.title}
            />
          </Field>
          <Field>
            <FieldLabel>{t("products.formReview.values")}</FieldLabel>
            <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border p-2">
              {option.values.map((value, index) => (
                <span
                  className="inline-flex items-center rounded-full bg-secondary text-xs"
                  key={`${value.label}-${index}`}
                >
                  {isColor ? (
                    <ProductColorPopover
                      label={value.label}
                      onSave={(label, color) =>
                        update({
                          values: option.values.map((item, itemIndex) =>
                            itemIndex === index
                              ? { label, swatch: { kind: "color", value: color } }
                              : item,
                          ),
                        })
                      }
                      value={value.swatch?.value ?? "#808080"}
                    />
                  ) : (
                    <span className="px-2 py-1.5">{value.label}</span>
                  )}
                  <button
                    aria-label={t("products.formReview.removeValueAria", { value: value.label })}
                    className="mr-1 grid size-6 place-items-center rounded-full hover:bg-background"
                    onClick={() => update({ values: option.values.filter((_, i) => i !== index) })}
                    type="button"
                  >
                    <AppIcons.close className="size-3" />
                  </button>
                </span>
              ))}
              {isColor ? (
                <ProductColorPopover
                  onSave={(label, color) => addValue(label, { kind: "color", value: color })}
                />
              ) : (
                <input
                  className="min-w-28 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
                  onChange={(event) => setDraftValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      addValue(draftValue);
                    }
                  }}
                  onPaste={(event) => {
                    const labels = event.clipboardData
                      .getData("text")
                      .split(/[,\n]/)
                      .map((label) => label.trim())
                      .filter(Boolean);
                    if (labels.length < 2) return;
                    event.preventDefault();
                    const seen = new Set(option.values.map((value) => value.label.toLowerCase()));
                    const additions = labels
                      .filter((label) => {
                        const normalized = label.toLowerCase();
                        if (seen.has(normalized)) return false;
                        seen.add(normalized);
                        return true;
                      })
                      .map((label) => ({ label }));
                    update({ values: [...option.values, ...additions] });
                    setDraftValue("");
                  }}
                  placeholder={t("products.formReview.addAnotherValue")}
                  value={draftValue}
                />
              )}
            </div>
            <FieldDescription>{t("products.formReview.valuesHelpShort")}</FieldDescription>
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button disabled={saving} onClick={() => onOpenChange(false)} variant="outline">
            {t("common.cancel")}
          </Button>
          <Button
            disabled={saving || !option.title.trim() || !option.values.length}
            onClick={() => onSave(option)}
          >
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
