"use client";

import type { MerchantProductCollection } from "@ecs/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import { DataTableFilters } from "@/components/app/data-table-filters";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
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
import {
  CollectionIdentityCell,
  TaxonomyDateCell,
  TaxonomyHandleCell,
} from "@/features/catalog-taxonomy/taxonomy-table-cells";
import {
  filterCollectionsForTable,
  getCollectionDisplayName,
  getTaxonomyTableCounts,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import { copyTextToClipboard } from "@/lib/clipboard";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type ProductCollectionsTableProps = {
  collections: MerchantProductCollection[];
  footer?: ReactNode;
  pageSize: number;
  totalCount: number;
  tenantId?: string | undefined;
};

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

function getCollectionColumns(
  onDelete: (collectionId: string) => void,
): ColumnDef<MerchantProductCollection>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all visible collections"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${getCollectionDisplayName(row.original)}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "title",
      accessorFn: (collection) => getCollectionDisplayName(collection),
      header: ({ column }) => <DataTableHeader column={column} title="Collection" />,
      cell: ({ row }) => <CollectionIdentityCell collection={row.original} />,
    },
    {
      accessorKey: "handle",
      header: ({ column }) => <DataTableHeader column={column} title="Handle" />,
      cell: ({ row }) => <TaxonomyHandleCell handle={row.original.handle} />,
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
        const collection = row.original;

        return (
          <RowActionsMenu
            actions={[
              {
                label: "Copy collection ID",
                onSelect: () => copyToClipboard(collection.id, "Collection ID"),
                type: "button",
              },
              {
                disabled: !collection.handle,
                label: "Copy handle",
                onSelect: () => copyToClipboard(collection.handle ?? "", "Handle"),
                type: "button",
              },
              { id: "danger", type: "separator" },
              {
                label: "Delete collection",
                onSelect: () => onDelete(collection.id),
                type: "button",
                variant: "destructive",
              },
            ]}
            label={`Open actions for ${getCollectionDisplayName(collection)}`}
          />
        );
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];
}

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

export function ProductCollectionsTable({
  collections,
  footer,
  pageSize,
  totalCount,
  tenantId,
}: ProductCollectionsTableProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  void pageSize;

  const [deleteCollectionId, setDeleteCollectionId] = useState<string | null>(null);
  const [selectedCollectionIdsForDelete, setSelectedCollectionIdsForDelete] = useState<string[]>(
    [],
  );
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  const columns = useMemo(() => getCollectionColumns((id) => setDeleteCollectionId(id)), []);

  const deleteCollectionMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      const url = getTenantScopedPath(
        dashboardRoutes.productCollectionDeleteAction(collectionId),
        tenantId,
      );
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete product collection.");
      }
      return collectionId;
    },
    onSuccess: () => {
      toast.success("Product collection deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["product-collections"] });
      setDeleteCollectionId(null);
      router.refresh();
    },
    onError: (error) => {
      toast.error(getDeletionErrorMessage(error, "Product collection"));
    },
  });

  const batchDeleteCollectionsMutation = useMutation({
    mutationFn: async (collectionIds: string[]) => {
      const url = getTenantScopedPath(
        dashboardRoutes.productCollectionsBatchDeleteAction,
        tenantId,
      );
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collectionIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete product collections.");
      }
      return collectionIds;
    },
    onSuccess: () => {
      toast.success("Selected product collections deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["product-collections"] });
      setSelectedCollectionIdsForDelete([]);
      setShowBatchDeleteDialog(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(getDeletionErrorMessage(error, "Product collections"));
    },
  });

  const filteredCollections = useMemo(
    () => filterCollectionsForTable(collections, { query }),
    [collections, query],
  );
  const counts = getTaxonomyTableCounts({
    filteredCount: filteredCollections.length,
    pageCount: collections.length,
    query,
    totalCount,
  });

  const toolbar = (
    <div className="flex flex-col gap-3">
      <DataTableFilters filters={[]} onClearAll={() => setQuery("")}>
        <ListToolbarSearch
          clearLabel="Clear collection search"
          label="Search product collections"
          onChange={setQuery}
          placeholder="Search collections"
          value={query}
        />
      </DataTableFilters>
      <p className="text-sm text-muted-foreground">
        {counts.hasActiveFilter
          ? `${counts.filteredCount} of ${counts.pageCount} on this page`
          : `${counts.pageCount} on this page, ${counts.totalCount} total`}
      </p>
    </div>
  );

  const collectionToDelete = collections.find((c) => c.id === deleteCollectionId);

  return (
    <>
      <DataTable
        bulkActions={(selectedCollections) => (
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                copyToClipboard(
                  selectedCollections.map((collection) => collection.id).join("\n"),
                  "Collection IDs",
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
                setSelectedCollectionIdsForDelete(selectedCollections.map((c) => c.id));
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
        data={filteredCollections}
        emptyMessage="No product collections have been synced for this merchant yet."
        emptyTitle="No collections yet"
        filteredEmptyMessage="No product collections match the current search."
        filteredEmptyTitle="No matching collections"
        getRowId={(collection) => collection.id}
        isFiltered={counts.hasActiveFilter}
        selectedSummaryLabel={(count) => `collection${count === 1 ? "" : "s"} selected`}
        toolbar={toolbar}
        footer={footer}
      />

      <AlertDialog
        open={deleteCollectionId !== null}
        onOpenChange={(open) => !open && setDeleteCollectionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;
              {collectionToDelete
                ? getCollectionDisplayName(collectionToDelete)
                : "this collection"}
              &rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCollectionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteCollectionMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteCollectionId) deleteCollectionMutation.mutate(deleteCollectionId);
              }}
              variant="destructive"
            >
              {deleteCollectionMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product collections</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCollectionIdsForDelete.length} selected
              collections? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleteCollectionsMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={batchDeleteCollectionsMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                batchDeleteCollectionsMutation.mutate(selectedCollectionIdsForDelete);
              }}
              variant="destructive"
            >
              {batchDeleteCollectionsMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
