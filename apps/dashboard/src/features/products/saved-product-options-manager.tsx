"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { DataTableHeader } from "@/components/app/data-table-header";
import { HelpTip } from "@/components/app/help-tip";
import { AppIcons } from "@/components/app/icons";
import { ListSummary } from "@/components/app/list-page-controls";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { PageShell } from "@/components/app/page-shell";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  const [search, setSearch] = useState("");
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

  const startCreating = () => setEditing({ id: "", isNew: true, title: "", values: [] });
  const options = query.data?.optionSets ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      normalizedSearch
        ? options.filter(
            (option) =>
              option.title.toLowerCase().includes(normalizedSearch) ||
              option.values.some((value) => value.label.toLowerCase().includes(normalizedSearch)),
          )
        : options,
    [normalizedSearch, options],
  );
  const cloneForEditing = (option: SavedOption): SavedOptionDraft => ({
    ...option,
    values: option.values.map((value) =>
      value.swatch ? { ...value, swatch: { ...value.swatch } } : { label: value.label },
    ),
  });
  const columns = useMemo<ColumnDef<SavedOption>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableHeader column={column} title={t("products.savedOptions.columnOption")} />
        ),
        cell: ({ row }) => (
          <button
            className="font-medium text-foreground transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none"
            onClick={() => setEditing(cloneForEditing(row.original))}
            type="button"
          >
            {row.original.title}
          </button>
        ),
      },
      {
        id: "values",
        header: t("products.savedOptions.columnValues"),
        cell: ({ row }) => {
          const visibleValues = row.original.values.slice(0, 4);
          const remaining = row.original.values.length - visibleValues.length;
          return (
            <div className="flex min-w-52 flex-wrap items-center gap-1.5">
              {visibleValues.map((value) => (
                <Badge className="gap-1.5 font-normal" key={value.label} variant="secondary">
                  {value.swatch ? (
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full border border-border"
                      style={{ backgroundColor: value.swatch.value }}
                    />
                  ) : null}
                  {value.label}
                </Badge>
              ))}
              {remaining > 0 ? (
                <span className="text-xs text-muted-foreground">+{remaining}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "valueCount",
        header: t("products.savedOptions.columnCount"),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">{row.original.values.length}</span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActionsMenu
              actions={[
                {
                  icon: AppIcons.edit,
                  label: t("common.edit"),
                  onSelect: () => setEditing(cloneForEditing(row.original)),
                  type: "button",
                },
                { id: "delete", type: "separator" },
                {
                  icon: AppIcons.trash,
                  label: t("common.delete"),
                  onSelect: () => setPendingDelete(row.original),
                  type: "button",
                  variant: "destructive",
                },
              ]}
              label={t("products.savedOptions.actionsAria", { name: row.original.title })}
            />
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <PageShell
      actions={
        <Button onClick={startCreating}>
          <AppIcons.add data-icon="inline-start" />
          {t("products.savedOptions.newAction")}
        </Button>
      }
      meta={
        <HelpTip
          label={t("products.savedOptions.helpLabel")}
          summary={t("products.savedOptions.pageDescription")}
        />
      }
      title={t("products.savedOptions.pageTitle")}
    >
      {query.isError ? (
        <Alert variant="destructive">
          <AppIcons.error />
          <AlertTitle>{t("products.savedOptions.loadFailedTitle")}</AlertTitle>
          <AlertDescription>{t("products.savedOptions.loadFailed")}</AlertDescription>
          <AlertAction>
            <Button onClick={() => void query.refetch()} size="sm" variant="outline">
              {t("common.tryAgain")}
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <>
          {!query.isPending ? (
            <ListSummary count={filteredOptions.length} filtered={Boolean(normalizedSearch)} />
          ) : null}
          <DataTable
            columns={columns}
            data={filteredOptions}
            emptyIcon={<AppIcons.tag />}
            emptyMessage={t("products.savedOptions.emptyDescription")}
            emptyTitle={t("products.savedOptions.emptyTitle")}
            filteredEmptyMessage={t("products.savedOptions.filteredEmptyDescription")}
            filteredEmptyTitle={t("products.savedOptions.filteredEmptyTitle")}
            getRowId={(option) => option.id}
            isFiltered={Boolean(normalizedSearch)}
            isLoading={query.isPending}
            pageSize={20}
            toolbar={
              <ListToolbarSearch
                clearLabel={t("common.clearSearch")}
                label={t("products.savedOptions.searchLabel")}
                onChange={setSearch}
                placeholder={t("products.savedOptions.searchPlaceholder")}
                value={search}
              />
            }
          />
        </>
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
    </PageShell>
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
            <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-[1rem] border px-2 py-1">
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
                    } else if (
                      event.key === "Backspace" &&
                      !draftValue &&
                      currentOption.values.length
                    ) {
                      update({ values: currentOption.values.slice(0, -1) });
                    }
                  }}
                  onBlur={() => addValue(draftValue)}
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
