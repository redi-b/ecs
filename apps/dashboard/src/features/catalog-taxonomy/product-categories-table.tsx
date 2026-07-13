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
import {
  listToolbarControlClassName,
  ListToolbarSearch,
  ListViewToggle,
} from "@/components/app/list-toolbar";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

async function copyToClipboard(value: string, label: string) {
  try {
    const copied = await copyTextToClipboard(value);

    if (!copied) {
      toast.error("Nothing to copy.");
      return;
    }

    toast.success(`${label} copied.`);
  } catch {
    toast.error("Could not copy. Try again.");
  }
}

function getCategoryColumns(
  categoriesById: Map<string, MerchantProductCategory>,
  onDelete: (categoryId: string) => void,
  onEdit: (category: MerchantProductCategory) => void,
): ColumnDef<MerchantProductCategory>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all visible categories"
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
      header: ({ column }) => <DataTableHeader column={column} title="Category" />,
      cell: ({ row }) => (
        <CategoryIdentityCell category={row.original} onOpen={() => onEdit(row.original)} />
      ),
    },
    {
      accessorKey: "handle",
      header: ({ column }) => <DataTableHeader column={column} title="Handle" />,
      cell: ({ row }) => <TaxonomyHandleCell handle={row.original.handle} />,
    },
    {
      id: "parent",
      accessorFn: (category) => category.parentCategoryId ?? "",
      header: ({ column }) => <DataTableHeader column={column} title="Parent" />,
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
      header: ({ column }) => <DataTableHeader column={column} title="Visibility" />,
      cell: ({ row }) => {
        const hidden = row.original.visibility === "hidden";
        return (
          <Badge variant={hidden ? "secondary" : "outline"}>
            {hidden ? "Hidden" : "Public"}
          </Badge>
        );
      },
    },
    {
      id: "rank",
      accessorFn: (category) => category.rank ?? 0,
      header: ({ column }) => <DataTableHeader column={column} title="Order" />,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{row.original.rank ?? 0}</span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => <DataTableHeader column={column} title="Updated" />,
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
                label: "Edit category",
                onSelect: () => onEdit(category),
                type: "button",
              },
              {
                icon: AppIcons.copy,
                label: "Copy category ID",
                onSelect: () => copyToClipboard(category.id, "Category ID"),
                type: "button",
              },
              {
                disabled: !category.handle,
                icon: AppIcons.copy,
                label: "Copy handle",
                onSelect: () => copyToClipboard(category.handle ?? "", "Handle"),
                type: "button",
              },
              { id: "danger", type: "separator" },
              {
                icon: AppIcons.trash,
                label: "Delete category",
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

function getDeletionErrorMessage(error: unknown, resourceName: string) {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "commerce_backend_unavailable") {
    return "Catalog changes are temporarily unavailable. Try again.";
  }
  if (code === "commerce_credentials_missing" || code === "commerce_credentials_invalid") {
    return "Catalog changes are temporarily unavailable. Contact support.";
  }
  if (
    code === "product_not_found" ||
    code === "category_not_found" ||
    code === "collection_not_found"
  ) {
    return `${resourceName} not found.`;
  }
  return `Failed to delete ${resourceName.toLowerCase()}. Try again.`;
}

export function ProductCategoriesTable({
  categories,
  footer,
  initialQuery = "",
  pageSize,
  totalCount,
  tenantId,
}: ProductCategoriesTableProps) {
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
      ),
    [categoriesById],
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
      toast.success("Product category deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setDeleteCategoryId(null);
      router.refresh();
    },
    onError: (error) => {
      toast.error(getDeletionErrorMessage(error, "Product category"));
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
      toast.success("Selected product categories deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setSelectedCategoryIdsForDelete([]);
      setShowBatchDeleteDialog(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(getDeletionErrorMessage(error, "Product categories"));
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
      label: "Visibility",
      defaultValue: "all",
      value: visibility,
      onChange: (value) => setVisibility(value as TaxonomyVisibilityFilter),
      options: [
        { label: "All visibility", value: "all" },
        { label: "Public", value: "public" },
        { label: "Hidden", value: "hidden" },
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
                { icon: AppIcons.list, label: "Table", value: "table" },
                { icon: AppIcons.tree, label: "Tree", value: "tree" },
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
              Reorder
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
          clearLabel="Clear category search"
          label="Search product categories"
          onChange={(value) => {
            setSearchValue(value);
            pushQuery(value);
          }}
          placeholder="Search categories"
          value={searchValue}
        />
      </DataTableFilters>
      <p className="text-sm text-muted-foreground">
        {pending
          ? "Updating…"
          : hasClientPageFilter
            ? `${counts.filteredCount} of ${counts.pageCount} on this page`
            : hasServerFilter
              ? `${categories.length} of ${totalCount} matching`
              : `${counts.pageCount} on this page, ${counts.totalCount} total`}
      </p>
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
      {viewMode === "tree" ? (
        <div className="space-y-3">
          {toolbar}
          <CategoryTreeView
            categories={filteredCategories}
            onEdit={(category) => setEditingCategory(category)}
            query={initialQuery}
          />
          {footer}
        </div>
      ) : (
      <DataTable
        bulkActions={(selectedCategories) => (
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                copyToClipboard(
                  selectedCategories.map((category) => category.id).join("\n"),
                  "Category IDs",
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <AppIcons.copy data-icon="inline-start" />
              Copy IDs
            </Button>
            <Button
              onClick={() => {
                setSelectedCategoryIdsForDelete(selectedCategories.map((c) => c.id));
                setShowBatchDeleteDialog(true);
              }}
              size="sm"
              type="button"
              variant="destructive"
            >
              <AppIcons.trash data-icon="inline-start" />
              Delete selected
            </Button>
          </div>
        )}
        columns={columns}
        data={filteredCategories}
        emptyMessage="No product categories have been synced for this merchant yet."
        emptyTitle="No categories yet"
        filteredEmptyMessage="No product categories match the current search."
        filteredEmptyTitle="No matching categories"
        getRowId={(category) => category.id}
        isFiltered={counts.hasActiveFilter}
        selectedSummaryLabel={(count) => `categor${count === 1 ? "y" : "ies"} selected`}
        toolbar={toolbar}
        footer={footer}
      />
      )}

      <AlertDialog
        open={deleteCategoryId !== null}
        onOpenChange={(open) => !open && setDeleteCategoryId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;
              {categoryToDelete ? getCategoryDisplayName(categoryToDelete) : "this category"}
              &rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCategoryMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteCategoryMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteCategoryId) deleteCategoryMutation.mutate(deleteCategoryId);
              }}
              variant="destructive"
            >
              {deleteCategoryMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product categories</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCategoryIdsForDelete.length} selected
              categories? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleteCategoriesMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={batchDeleteCategoriesMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                batchDeleteCategoriesMutation.mutate(selectedCategoryIdsForDelete);
              }}
              variant="destructive"
            >
              {batchDeleteCategoriesMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
