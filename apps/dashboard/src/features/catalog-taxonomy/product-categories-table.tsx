"use client";

import type { MerchantProductCategory } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

import { DataTable } from "@/components/app/data-table";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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
} from "@/features/catalog-taxonomy/taxonomy-table-state";



function copyToClipboard(value: string) {
  if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(value).catch(() => undefined);
}

function getCategoryColumns(
  categoriesById: Map<string, MerchantProductCategory>,
  onDelete: (categoryId: string) => void,
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
      cell: ({ row }) => <CategoryIdentityCell category={row.original} />,
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
      accessorKey: "updatedAt",
      header: ({ column }) => <DataTableHeader column={column} title="Updated" />,
      cell: ({ row }) => <TaxonomyDateCell value={row.original.updatedAt} />,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableHeader column={column} title="Created" />,
      cell: ({ row }) => <TaxonomyDateCell value={row.original.createdAt} />,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const category = row.original;

        return (
          <RowActionsMenu
            actions={[
              {
                label: "Copy category ID",
                onSelect: () => copyToClipboard(category.id),
                type: "button",
              },
              {
                disabled: !category.handle,
                label: "Copy handle",
                onSelect: () => copyToClipboard(category.handle ?? ""),
                type: "button",
              },
              { type: "separator" },
              {
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
  pageSize: number;
  totalCount: number;
  tenantId?: string | undefined;
};

export function ProductCategoriesTable({
  categories,
  pageSize,
  totalCount,
  tenantId,
}: ProductCategoriesTableProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  void pageSize;

  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [selectedCategoryIdsForDelete, setSelectedCategoryIdsForDelete] = useState<string[]>([]);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const columns = useMemo(
    () => getCategoryColumns(categoriesById, (id) => setDeleteCategoryId(id)),
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
      toast.error(error instanceof Error ? error.message : "Failed to delete product category.");
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
      toast.error(error instanceof Error ? error.message : "Failed to delete product categories.");
    },
  });

  const filteredCategories = useMemo(
    () => filterCategoriesForTable(categories, { query }),
    [categories, query],
  );
  const counts = getTaxonomyTableCounts({
    filteredCount: filteredCategories.length,
    pageCount: categories.length,
    query,
    totalCount,
  });

  const toolbar = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <InputGroup className="h-10 rounded-full bg-background/70 px-1 sm:max-w-sm">
        <InputGroupAddon>
          <AppIcons.search data-icon="inline-start" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search product categories"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search categories"
          value={query}
        />
      </InputGroup>
      <p className="text-sm text-muted-foreground">
        {counts.hasActiveFilter
          ? `${counts.filteredCount} of ${counts.pageCount} on this page`
          : `${counts.pageCount} on this page, ${counts.totalCount} total`}
      </p>
    </div>
  );

  const categoryToDelete = categories.find((c) => c.id === deleteCategoryId);

  return (
    <>
      <DataTable
        bulkActions={(selectedCategories) => (
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                copyToClipboard(selectedCategories.map((category) => category.id).join("\n"))
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
              Delete selected
            </Button>
          </div>
        )}
        columns={columns}
        data={filteredCategories}
        emptyMessage="No product categories have been synced for this merchant yet."
        filteredEmptyMessage="No product categories match the current search."
        getRowId={(category) => category.id}
        isFiltered={counts.hasActiveFilter}
        selectedSummaryLabel={(count) => `categor${count === 1 ? "y" : "ies"} selected`}
        toolbar={toolbar}
      />

      <AlertDialog
        open={deleteCategoryId !== null}
        onOpenChange={(open) => !open && setDeleteCategoryId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{categoryToDelete ? getCategoryDisplayName(categoryToDelete) : "this category"}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCategoryMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={deleteCategoryMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteCategoryId) deleteCategoryMutation.mutate(deleteCategoryId);
              }}
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
              Are you sure you want to delete {selectedCategoryIdsForDelete.length} selected categories?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleteCategoriesMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={batchDeleteCategoriesMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                batchDeleteCategoriesMutation.mutate(selectedCategoryIdsForDelete);
              }}
            >
              {batchDeleteCategoriesMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
