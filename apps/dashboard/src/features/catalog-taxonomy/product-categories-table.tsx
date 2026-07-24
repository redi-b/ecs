"use client";

import type { MerchantProductCategory } from "@ecs/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import {
  type DataTableFilterDefinition,
  DataTableFilters,
} from "@/components/app/data-table-filters";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
import { ListResultsStatus } from "@/components/app/list-results-status";
import {
  listToolbarControlClassName,
  ListToolbarSearch,
  ListViewToggle,
} from "@/components/app/list-toolbar";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CategoryEditSheet } from "@/features/catalog-taxonomy/category-edit-sheet";
import { CategoryReorderSheet } from "@/features/catalog-taxonomy/category-reorder-sheet";
import { CategoryTreeView } from "@/features/catalog-taxonomy/category-tree-view";
import {
  CategoryIdentityCell,
  CategoryParentCell,
  TaxonomyDateCell,
  TaxonomyHandleCell,
} from "@/features/catalog-taxonomy/taxonomy-table-cells";
import {
  filterCategoriesForTable,
  getCategoryDisplayName,
  getTaxonomyTableCounts,
  type TaxonomyVisibilityFilter,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import { copyTextToClipboard } from "@/lib/clipboard";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";
import { useI18n } from "@/i18n/provider";

async function copyToClipboard(
  value: string,
  label: string,
  t: (key: any, values?: Record<string, string | number>) => string,
) {
  try {
    const copied = await copyTextToClipboard(value);

    if (!copied) {
      toast.error(t("table.actions.copyEmpty"));
      return;
    }

    toast.success(t("table.actions.copySuccess", { label }));
  } catch {
    toast.error(t("table.actions.copyFailed"));
  }
}

function getCategoryColumns(
  categoriesById: Map<string, MerchantProductCategory>,
  onDelete: (categoryId: string) => void,
  onEdit: (category: MerchantProductCategory) => void,
  t: (key: any, values?: Record<string, string | number>) => string,
): ColumnDef<MerchantProductCategory>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label={t("taxonomy.table.selectAllAria", { entityPlural: t("taxonomy.entity.category.plural") })}
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${getCategoryDisplayName(row.original)}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "name",
      accessorFn: (category) => getCategoryDisplayName(category),
      header: ({ column }) => <DataTableHeader column={column} title={t("taxonomy.table.category")} />,
      cell: ({ row }) => (
        <CategoryIdentityCell category={row.original} onOpen={() => onEdit(row.original)} />
      ),
    },
    {
      accessorKey: "handle",
      header: ({ column }) => <DataTableHeader column={column} title={t("taxonomy.table.handle")} />,
      cell: ({ row }) => <TaxonomyHandleCell handle={row.original.handle} />,
    },
    {
      id: "parent",
      accessorFn: (category) => category.parentCategoryId ?? "",
      header: ({ column }) => <DataTableHeader column={column} title={t("taxonomy.table.parent")} />,
      cell: ({ row }) => (
        <CategoryParentCell
          parentCategory={
            row.original.parentCategoryId
              ? categoriesById.get(row.original.parentCategoryId)
              : undefined
          }
          parentCategoryId={row.original.parentCategoryId}
        />
      ),
    },
    {
      id: "visibility",
      accessorFn: (category) => category.visibility ?? "public",
      header: ({ column }) => <DataTableHeader column={column} title={t("taxonomy.table.visibility.label")} />,
      cell: ({ row }) => {
        const hidden = row.original.visibility === "hidden";
        return (
          <Badge variant={hidden ? "secondary" : "outline"}>
            {hidden ? t("taxonomy.table.visibility.hidden") : t("taxonomy.table.visibility.public")}
          </Badge>
        );
      },
    },
    {
      id: "rank",
      accessorFn: (category) => category.rank ?? 0,
      header: ({ column }) => <DataTableHeader column={column} title={t("taxonomy.table.order")} />,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{row.original.rank ?? 0}</span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => <DataTableHeader column={column} title={t("taxonomy.table.updated")} />,
      cell: ({ row }) => <TaxonomyDateCell value={row.original.updatedAt} />,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const category = row.original;

        return (
          <RowActionsMenu
            actions={[
              {
                icon: AppIcons.edit,
                label: t("taxonomy.table.actions.edit", { entity: t("taxonomy.entity.category.label") }),
                onSelect: () => onEdit(category),
                type: "button",
              },
              {
                icon: AppIcons.copy,
                label: t("taxonomy.table.actions.copyId", { entity: t("taxonomy.entity.category.label") }),
                onSelect: () => copyToClipboard(category.id, t("taxonomy.table.actions.copyId", { entity: t("taxonomy.entity.category.label") }), t),
                type: "button",
              },
              {
                disabled: !category.handle,
                icon: AppIcons.copy,
                label: t("taxonomy.table.actions.copyHandle"),
                onSelect: () => copyToClipboard(category.handle ?? "", t("taxonomy.table.handle"), t),
                type: "button",
              },
              { id: "danger", type: "separator" },
              {
                icon: AppIcons.trash,
                label: t("taxonomy.table.actions.delete", { entity: t("taxonomy.entity.category.label") }),
                onSelect: () => onDelete(category.id),
                type: "button",
                variant: "destructive",
              },
            ]}
            label={`Open actions for ${getCategoryDisplayName(category)}`}
          />
        );
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];
}

type ProductCategoriesTableProps = {
  categories: MerchantProductCategory[];
  footer?: ReactNode;
  initialQuery?: string | undefined;
  pageSize: number;
  totalCount: number;
  tenantId?: string | undefined;
};

function getDeletionErrorMessage(
  error: unknown,
  resource: string,
  t: (key: import("@/i18n/messages").MessageKey, values?: Record<string, string | number | Date>) => string,
) {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "commerce_backend_unavailable") {
    return t("taxonomy.deleteErrors.catalogUnavailable");
  }
  if (code === "commerce_credentials_missing" || code === "commerce_credentials_invalid") {
    return t("taxonomy.deleteErrors.catalogContactSupport");
  }
  if (
    code === "product_not_found" ||
    code === "category_not_found" ||
    code === "collection_not_found"
  ) {
    return t("taxonomy.deleteErrors.notFound", { resource });
  }
  return t("taxonomy.deleteErrors.failed", { resource });
}

export function ProductCategoriesTable({
  categories,
  footer,
  initialQuery = "",
  pageSize,
  totalCount,
  tenantId,
}: ProductCategoriesTableProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(initialQuery);
  const [visibility, setVisibility] = useState<TaxonomyVisibilityFilter>("all");
  void pageSize;

  useEffect(() => {
    setSearchValue(initialQuery);
  }, [initialQuery]);

  const pushQuery = useCallback(
    (q: string) => {
      const url = new URL(window.location.href);
      if (q.trim()) url.searchParams.set("q", q.trim());
      else url.searchParams.delete("q");
      url.searchParams.delete("page");
      startTransition(() => {
        router.push(`${url.pathname}?${url.searchParams.toString()}`);
      });
    },
    [router],
  );

  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<MerchantProductCategory | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "tree">("table");
  const [selectedCategoryIdsForDelete, setSelectedCategoryIdsForDelete] = useState<string[]>([]);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const columns = useMemo(
    () =>
      getCategoryColumns(
        categoriesById,
        (id) => setDeleteCategoryId(id),
        (category) => setEditingCategory(category),
        t,
      ),
    [categoriesById, t],
  );

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const url = getTenantScopedPath(
        dashboardRoutes.productCategoryDeleteAction(categoryId),
        tenantId,
      );
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete product category.");
      }
      return categoryId;
    },
    onSuccess: () => {
      toast.success(t("taxonomy.create.success", { entity: t("taxonomy.entity.category.label") }));
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setDeleteCategoryId(null);
      router.refresh();
    },
    onError: (error) => {
      toast.error(
        getDeletionErrorMessage(error, t("taxonomy.entity.category.label"), t),
      );
    },
  });

  const batchDeleteCategoriesMutation = useMutation({
    mutationFn: async (categoryIds: string[]) => {
      const url = getTenantScopedPath(dashboardRoutes.productCategoriesBatchDeleteAction, tenantId);
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete product categories.");
      }
      return categoryIds;
    },
    onSuccess: () => {
      toast.success(t("taxonomy.create.success", { entity: t("taxonomy.entity.category.plural") }));
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setSelectedCategoryIdsForDelete([]);
      setShowBatchDeleteDialog(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(
        getDeletionErrorMessage(error, t("taxonomy.entity.category.plural"), t),
      );
    },
  });

  const filteredCategories = useMemo(
    () => filterCategoriesForTable(categories, { query: "", visibility }),
    [categories, visibility],
  );
  const counts = getTaxonomyTableCounts({
    filteredCount: filteredCategories.length,
    pageCount: categories.length,
    query: initialQuery,
    totalCount,
    visibility,
  });
  const hasServerFilter = Boolean(initialQuery.trim());
  const hasClientPageFilter = visibility !== "all";

  const filters: DataTableFilterDefinition[] = [
    {
      id: "visibility",
      label: t("taxonomy.table.visibility.label"),
      defaultValue: "all",
      value: visibility,
      onChange: (value) => setVisibility(value as TaxonomyVisibilityFilter),
      options: [
        { label: t("taxonomy.table.visibility.all"), value: "all" },
        { label: t("taxonomy.table.visibility.public"), value: "public" },
        { label: t("taxonomy.table.visibility.hidden"), value: "hidden" },
      ],
    },
  ];

  const toolbar = (
    <div className="flex flex-col gap-3">
      <DataTableFilters
        actions={
          <>
            <ListViewToggle
              onChange={setViewMode}
              options={[
                { icon: AppIcons.list, label: t("common.view.table"), value: "table" },
                { icon: AppIcons.tree, label: t("common.view.tree"), value: "tree" },
              ]}
              value={viewMode}
            />
            <Button
              className={listToolbarControlClassName}
              onClick={() => setReorderOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <AppIcons.arrowUpDown data-icon="inline-start" />
              {t("taxonomy.actions.reorder")}
            </Button>
          </>
        }
        filters={filters}
        onClearAll={() => {
          setVisibility("all");
          setSearchValue("");
          pushQuery("");
        }}
      >
        <ListToolbarSearch
          clearLabel={t("taxonomy.table.clearCategorySearch")}
          label={t("taxonomy.table.searchCategories")}
          onChange={(value) => {
            setSearchValue(value);
            pushQuery(value);
          }}
          placeholder={t("taxonomy.table.searchCategoriesPlaceholder")}
          value={searchValue}
        />
      </DataTableFilters>
      <ListResultsStatus
        filteredPageCount={counts.filteredCount}
        hasClientPageFilter={hasClientPageFilter}
        hasServerFilter={hasServerFilter}
        pageCount={categories.length}
        pending={pending}
        totalCount={totalCount}
      />
    </div>
  );

  const categoryToDelete = categories.find((c) => c.id === deleteCategoryId);

  return (
    <>
      <CategoryEditSheet
        categories={categories}
        category={editingCategory}
        onOpenChange={(next) => {
          if (!next) setEditingCategory(null);
        }}
        open={Boolean(editingCategory)}
        tenantId={tenantId}
      />
      <CategoryReorderSheet
        categories={categories}
        onOpenChange={setReorderOpen}
        open={reorderOpen}
        tenantId={tenantId}
      />
      {/* Shared shell keeps ListViewToggle mounted across Table/Tree switches. */}
      <div className="mb-4 flex w-full min-w-0 flex-col overflow-hidden rounded-[1.35rem] border bg-card/95 lg:mb-6">
        <div className="shrink-0 border-b bg-muted/20 p-3">{toolbar}</div>
        {viewMode === "tree" ? (
          <>
            <CategoryTreeView
              categories={filteredCategories}
              embedded
              onEdit={(category) => setEditingCategory(category)}
              query={initialQuery}
            />
            {footer && filteredCategories.length > 0 ? (
              <div className="shrink-0 border-t bg-muted/10 px-3 py-2">{footer}</div>
            ) : null}
          </>
        ) : (
          <DataTable
            bulkActions={(selectedCategories) => (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() =>
                    copyToClipboard(
                      selectedCategories.map((category) => category.id).join("\n"),
                      t("taxonomy.table.categoryIds"),
                      t,
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <AppIcons.copy data-icon="inline-start" />
                  {t("table.actions.copyIds")}
                </Button>
                <Button
                  onClick={() => {
                    setSelectedCategoryIdsForDelete(selectedCategories.map((c) => c.id));
                    setShowBatchDeleteDialog(true);
                  }}
                  size="sm"
                  type="button"
                  variant="destructive-outline"
                >
                  <AppIcons.trash data-icon="inline-start" />
                  Delete selected
                </Button>
              </div>
            )}
            columns={columns}
            data={filteredCategories}
            embedded
            emptyIcon={<AppIcons.tree className="size-5" aria-hidden />}
            emptyMessage={t("taxonomy.table.emptyMessage")}
            emptyTitle={t("taxonomy.table.emptyTitle")}
            filteredEmptyMessage={t("taxonomy.table.filteredEmptyMessage")}
            filteredEmptyTitle={t("taxonomy.table.filteredEmptyTitle")}
            footer={footer}
            getRowId={(category) => category.id}
            isFiltered={counts.hasActiveFilter}
            isLoading={pending}
            selectedSummaryLabel={t("taxonomy.table.selectedSummary")}
          />
        )}
      </div>

      <ConfirmDialog
        cancelDisabled={deleteCategoryMutation.isPending}
        confirmDisabled={deleteCategoryMutation.isPending}
        confirmLabel={
          deleteCategoryMutation.isPending ? t("common.deleting") : t("common.delete")
        }
        description={t("taxonomy.delete.desc", {
          name: categoryToDelete
            ? getCategoryDisplayName(categoryToDelete)
            : t("taxonomy.entity.category.label"),
        })}
        eyebrow={t("common.confirm.deleteEyebrow")}
        icon="trash"
        onConfirm={() => {
          if (deleteCategoryId) deleteCategoryMutation.mutate(deleteCategoryId);
        }}
        onOpenChange={(open) => {
          if (!open) setDeleteCategoryId(null);
        }}
        open={deleteCategoryId !== null}
        title={t("taxonomy.delete.title", { entity: t("taxonomy.entity.category.label") })}
      />

      <ConfirmDialog
        cancelDisabled={batchDeleteCategoriesMutation.isPending}
        confirmDisabled={batchDeleteCategoriesMutation.isPending}
        confirmLabel={
          batchDeleteCategoriesMutation.isPending ? t("common.deleting") : t("common.delete")
        }
        description={t("taxonomy.delete.batchDesc", {
          count: selectedCategoryIdsForDelete.length,
          entityPlural: t("taxonomy.entity.category.plural"),
        })}
        eyebrow={t("common.confirm.deleteEyebrow")}
        icon="trash"
        onConfirm={() => batchDeleteCategoriesMutation.mutate(selectedCategoryIdsForDelete)}
        onOpenChange={setShowBatchDeleteDialog}
        open={showBatchDeleteDialog}
        title={t("taxonomy.delete.batchTitle", {
          entityPlural: t("taxonomy.entity.category.plural"),
        })}
      />
    </>
  );
}
