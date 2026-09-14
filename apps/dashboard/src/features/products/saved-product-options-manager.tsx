"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/app/access-context";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { DataTableHeader } from "@/components/app/data-table-header";
import { HelpTip } from "@/components/app/help-tip";
import { AppIcons } from "@/components/app/icons";
import { ListSummary } from "@/components/app/list-page-controls";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { PageShell } from "@/components/app/page-shell";
import { type ResourceRowActions, RowActionsMenu } from "@/components/app/row-actions-menu";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProductColorPopover } from "@/features/products/product-form-sections";
import { ProductOptionValuesField } from "@/features/products/product-option-values-field";
import { useI18n } from "@/i18n/provider";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { rankFuzzyItems } from "@/lib/fuzzy-search";

type SavedValue = { label: string; swatch?: { kind: "color"; value: string } | null };
type SavedOption = { id: string; title: string; values: SavedValue[] };
type SavedOptionDraft = SavedOption & { isNew?: boolean };

function cloneForEditing(option: SavedOption): SavedOptionDraft {
  return {
    ...option,
    values: option.values.map((value) =>
      value.swatch ? { ...value, swatch: { ...value.swatch } } : { label: value.label },
    ),
  };
}

export function SavedProductOptionsManager({ tenantId }: { tenantId: string | null }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const canCreate = usePermission("products.create");
  const canUpdate = usePermission("products.update");
  const canDelete = usePermission("products.delete");
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
  const hasSearch = Boolean(search.trim());
  const filteredOptions = useMemo(
    () =>
      rankFuzzyItems(options, search, [
        { getValue: (option) => option.title, weight: 2 },
        { getValue: (option) => option.values.map((value) => value.label).join(" ") },
      ]),
    [options, search],
  );
  const optionRowActions = useCallback(
    (option: SavedOption): ResourceRowActions | null =>
      canUpdate || canDelete
        ? {
            actions: [
              ...(canUpdate
                ? [
                    {
                      icon: AppIcons.edit,
                      label: t("common.edit"),
                      onSelect: () => setEditing(cloneForEditing(option)),
                      type: "button" as const,
                    },
                  ]
                : []),
              ...(canUpdate && canDelete ? [{ id: "delete", type: "separator" as const }] : []),
              ...(canDelete
                ? [
                    {
                      icon: AppIcons.trash,
                      label: t("common.delete"),
                      onSelect: () => setPendingDelete(option),
                      type: "button" as const,
                      variant: "destructive" as const,
                    },
                  ]
                : []),
            ],
            label: t("products.savedOptions.actionsAria", { name: option.title }),
          }
        : null,
    [canDelete, canUpdate, t],
  );
  const columns = useMemo<ColumnDef<SavedOption>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableHeader column={column} title={t("products.savedOptions.columnOption")} />
        ),
        cell: ({ row }) =>
          canUpdate ? (
            <button
              className="font-medium text-foreground transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none"
              onClick={() => setEditing(cloneForEditing(row.original))}
              type="button"
            >
              {row.original.title}
            </button>
          ) : (
            <span className="font-medium text-foreground">{row.original.title}</span>
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
        cell: ({ row }) => {
          const actions = optionRowActions(row.original);
          return (
            <div className="flex justify-end">
              {actions ? <RowActionsMenu {...actions} /> : null}
            </div>
          );
        },
      },
    ],
    [canUpdate, optionRowActions, t],
  );

  return (
    <PageShell
      actions={
        canCreate ? (
          <Button onClick={startCreating}>
            <AppIcons.add data-icon="inline-start" />
            {t("products.savedOptions.newAction")}
          </Button>
        ) : null
      }
      titleAccessory={
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
            <ListSummary count={filteredOptions.length} filtered={hasSearch} />
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
            isFiltered={hasSearch}
            isLoading={query.isPending}
            pageSize={20}
            rowActions={optionRowActions}
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
      {canCreate || canUpdate ? (
        <SavedOptionEditDialog
          key={editing ? (editing.isNew ? "new" : editing.id) : "closed"}
          onChange={setEditing}
          onOpenChange={(open) => !open && setEditing(null)}
          onSave={(option) => save.mutate(option)}
          option={editing}
          saving={save.isPending}
        />
      ) : null}
      {canDelete ? (
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
      ) : null}
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
  const nameId = useId();
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
  const Root = option.isNew ? Dialog : Sheet;
  const Content = option.isNew ? DialogContent : SheetContent;
  const Header = option.isNew ? DialogHeader : SheetHeader;
  const Title = option.isNew ? DialogTitle : SheetTitle;
  const Description = option.isNew ? DialogDescription : SheetDescription;
  const Footer = option.isNew ? DialogFooter : SheetFooter;
  return (
    <Root onOpenChange={(open) => !saving && onOpenChange(open)} open>
      <Content
        className={
          option.isNew
            ? "flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
            : "gap-0 sm:max-w-lg"
        }
      >
        <Header className="shrink-0 gap-1.5 border-b p-4 pr-12 text-left sm:px-5">
          <Title>
            {option.isNew
              ? t("products.savedOptions.createTitle")
              : t("products.savedOptions.editTitle")}
          </Title>
          <Description>
            {option.isNew
              ? t("products.savedOptions.createDescription")
              : t("products.savedOptions.editDescription")}
          </Description>
        </Header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <fieldset disabled={saving} className="grid min-w-0 gap-5">
            <Field>
              <FieldLabel htmlFor={nameId}>{t("products.formReview.optionName")}</FieldLabel>
              <Input
                id={nameId}
                onChange={(event) => update({ title: event.target.value })}
                value={option.title}
              />
            </Field>
            <Field>
              <FieldLabel>{t("products.formReview.values")}</FieldLabel>
              <ProductOptionValuesField
                addControl={
                  isColor ? (
                    <ProductColorPopover
                      onSave={(label, color) => addValue(label, { kind: "color", value: color })}
                    />
                  ) : undefined
                }
                addLabel={t("products.formReview.addValue")}
                inputLabel={t("products.formReview.addValueAria", {
                  option: option.title || t("products.formReview.optionFallback"),
                })}
                onChange={setDraftValue}
                onCommit={() => addValue(draftValue)}
                onPasteMany={(rawValue) => {
                  const labels = rawValue
                    .split(/[,\n]/)
                    .map((label) => label.trim())
                    .filter(Boolean);
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
                onRemoveLast={
                  currentOption.values.length
                    ? () => update({ values: currentOption.values.slice(0, -1) })
                    : undefined
                }
                placeholder={t("products.formReview.addAnotherValue")}
                value={draftValue}
              >
                {option.values.map((value, index) => (
                  <span
                    className="inline-flex items-center rounded-full border border-border bg-secondary text-xs text-secondary-foreground"
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
                      onClick={() =>
                        update({ values: option.values.filter((_, i) => i !== index) })
                      }
                      type="button"
                    >
                      <AppIcons.close className="size-3" />
                    </button>
                  </span>
                ))}
              </ProductOptionValuesField>
              <FieldDescription>{t("products.formReview.valuesHelpShort")}</FieldDescription>
            </Field>
          </fieldset>
        </div>
        <Footer className="m-0 shrink-0 flex-row justify-end gap-2 rounded-none border-t p-4">
          <Button disabled={saving} onClick={() => onOpenChange(false)} variant="outline">
            {t("common.cancel")}
          </Button>
          <Button
            disabled={saving || !option.title.trim() || !option.values.length}
            onClick={() => onSave(option)}
          >
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </Footer>
      </Content>
    </Root>
  );
}
