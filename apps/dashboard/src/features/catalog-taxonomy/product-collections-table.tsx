"use client";

import type { MerchantProductCollection } from "@ecs/contracts";
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
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CollectionEditSheet } from "@/features/catalog-taxonomy/collection-edit-sheet";
import {
  CollectionIdentityCell,
  TaxonomyDateCell,
  TaxonomyHandleCell,
} from "@/features/catalog-taxonomy/taxonomy-table-cells";
import {
  filterCollectionsForTable,
  getCollectionDisplayName,
  getTaxonomyTableCounts,
  type TaxonomyVisibilityFilter,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import { copyTextToClipboard } from "@/lib/clipboard";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";
import { useI18n } from "@/i18n/provider";

type ProductCollectionsTableProps = {
  collections: MerchantProductCollection[];
  footer?: ReactNode;
  initialQuery?: string | undefined;
  pageSize: number;
  totalCount: number;
  tenantId?: string | undefined;
};

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

function getCollectionColumns(
  onDelete: (collectionId: string) => void,
  onEdit: (collection: MerchantProductCollection) => void,
  t: (key: any, values?: Record<string, string | number>) => string,
): ColumnDef<MerchantProductCollection>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label={t("taxonomy.table.selectAllAria", { entityPlural: t("taxonomy.entity.collection.plural") })}
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
      header: ({ column }) => <DataTableHeader column={column} title={t("taxonomy.table.collection")} />,
      cell: ({ row }) => (
        <CollectionIdentityCell collection={row.original} onOpen={() => onEdit(row.original)} />
      ),
    },
    {
      accessorKey: "handle",
      header: ({ column }) => <DataTableHeader column={column} title={t("taxonomy.table.handle")} />,
      cell: ({ row }) => <TaxonomyHandleCell handle={row.original.handle} />,
    },
    {
      id: "visibility",
      accessorFn: (collection) => collection.visibility ?? "public",
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
      accessorKey: "updatedAt",
      header: ({ column }) => <DataTableHeader column={column} title={t("taxonomy.table.updated")} />,
      cell: ({ row }) => <TaxonomyDateCell value={row.original.updatedAt} />,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const collection = row.original;

        return (
          <RowActionsMenu
            actions={[
              {
                icon: AppIcons.edit,
                label: t("taxonomy.table.actions.edit", { entity: t("taxonomy.entity.collection.label") }),
                onSelect: () => onEdit(collection),
                type: "button",
              },
              {
                icon: AppIcons.copy,
                label: t("taxonomy.table.actions.copyId", { entity: t("taxonomy.entity.collection.label") }),
                onSelect: () => copyToClipboard(collection.id, t("taxonomy.table.actions.copyId", { entity: t("taxonomy.entity.collection.label") }), t),
                type: "button",
              },
              {
                disabled: !collection.handle,
                icon: AppIcons.copy,
                label: t("taxonomy.table.actions.copyHandle"),
                onSelect: () => copyToClipboard(collection.handle ?? "", t("taxonomy.table.handle"), t),
                type: "button",
              },
              { id: "danger", type: "separator" },
              {
                icon: AppIcons.trash,
                label: t("taxonomy.table.actions.delete", { entity: t("taxonomy.entity.collection.label") }),
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

export function ProductCollectionsTable({
  collections,
  footer,
  initialQuery = "",
  pageSize,
  totalCount,
  tenantId,
}: ProductCollectionsTableProps) {
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

  const [deleteCollectionId, setDeleteCollectionId] = useState<string | null>(null);
  const [editingCollection, setEditingCollection] = useState<MerchantProductCollection | null>(
    null,
  );
  const [selectedCollectionIdsForDelete, setSelectedCollectionIdsForDelete] = useState<string[]>(
    [],
  );
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  const columns = useMemo(
    () =>
      getCollectionColumns(
        (id) => setDeleteCollectionId(id),
        (collection) => setEditingCollection(collection),
        t,
      ),
    [t],
  );

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
      toast.success(t("taxonomy.create.success", { entity: t("taxonomy.entity.collection.label") }));
      queryClient.invalidateQueries({ queryKey: ["product-collections"] });
      setDeleteCollectionId(null);
      router.refresh();
    },
    onError: (error) => {
      toast.error(
        getDeletionErrorMessage(error, t("taxonomy.entity.collection.label"), t),
      );
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
      toast.success(t("taxonomy.create.success", { entity: t("taxonomy.entity.collection.plural") }));
      queryClient.invalidateQueries({ queryKey: ["product-collections"] });
      setSelectedCollectionIdsForDelete([]);
      setShowBatchDeleteDialog(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(
        getDeletionErrorMessage(error, t("taxonomy.entity.collection.plural"), t),
      );
    },
  });

  const filteredCollections = useMemo(
    () => filterCollectionsForTable(collections, { query: "", visibility }),
    [collections, visibility],
  );
  const counts = getTaxonomyTableCounts({
    filteredCount: filteredCollections.length,
    pageCount: collections.length,
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
        filters={filters}
        onClearAll={() => {
          setVisibility("all");
          setSearchValue("");
          pushQuery("");
        }}
      >
        <ListToolbarSearch
          clearLabel={t("common.clearSearch")}
          label={t("taxonomy.table.searchCollections")}
          onChange={(value) => {
            setSearchValue(value);
            pushQuery(value);
          }}
          placeholder={t("taxonomy.table.searchCollectionsPlaceholder")}
          value={searchValue}
        />
      </DataTableFilters>
      <ListResultsStatus
        filteredPageCount={counts.filteredCount}
        hasClientPageFilter={hasClientPageFilter}
        hasServerFilter={hasServerFilter}
        pageCount={collections.length}
        pending={pending}
        totalCount={totalCount}
      />
    </div>
  );

  const collectionToDelete = collections.find((c) => c.id === deleteCollectionId);

  return (
    <>
      <CollectionEditSheet
        collection={editingCollection}
        onOpenChange={(next) => {
          if (!next) setEditingCollection(null);
        }}
        open={Boolean(editingCollection)}
        tenantId={tenantId}
      />
      <DataTable
        bulkActions={(selectedCollections) => (
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                copyToClipboard(
                  selectedCollections.map((collection) => collection.id).join("\n"),
                  t("taxonomy.table.collectionIds"),
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
                setSelectedCollectionIdsForDelete(selectedCollections.map((c) => c.id));
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
        data={filteredCollections}
        emptyIcon={<AppIcons.folder className="size-5" aria-hidden />}
        emptyMessage={t("taxonomy.table.collectionsEmptyMessage")}
        emptyTitle={t("taxonomy.table.collectionsEmptyTitle")}
        filteredEmptyMessage={t("taxonomy.table.collectionsFilteredEmptyMessage")}
        filteredEmptyTitle={t("taxonomy.table.collectionsFilteredEmptyTitle")}
        getRowId={(collection) => collection.id}
        isFiltered={counts.hasActiveFilter}
        isLoading={pending}
        selectedSummaryLabel={t("taxonomy.table.selectedSummary")}
        toolbar={toolbar}
        footer={footer}
      />

      <ConfirmDialog
        cancelDisabled={deleteCollectionMutation.isPending}
        confirmDisabled={deleteCollectionMutation.isPending}
        confirmLabel={
          deleteCollectionMutation.isPending ? t("common.deleting") : t("common.delete")
        }
        description={t("taxonomy.delete.desc", {
          name: collectionToDelete
            ? getCollectionDisplayName(collectionToDelete)
            : t("taxonomy.entity.collection.label"),
        })}
        eyebrow={t("common.confirm.deleteEyebrow")}
        icon="trash"
        onConfirm={() => {
          if (deleteCollectionId) deleteCollectionMutation.mutate(deleteCollectionId);
        }}
        onOpenChange={(open) => {
          if (!open) setDeleteCollectionId(null);
        }}
        open={deleteCollectionId !== null}
        title={t("taxonomy.delete.title", { entity: t("taxonomy.entity.collection.label") })}
      />

      <ConfirmDialog
        cancelDisabled={batchDeleteCollectionsMutation.isPending}
        confirmDisabled={batchDeleteCollectionsMutation.isPending}
        confirmLabel={
          batchDeleteCollectionsMutation.isPending ? t("common.deleting") : t("common.delete")
        }
        description={t("taxonomy.delete.batchDesc", {
          count: selectedCollectionIdsForDelete.length,
          entityPlural: t("taxonomy.entity.collection.plural"),
        })}
        eyebrow={t("common.confirm.deleteEyebrow")}
        icon="trash"
        onConfirm={() => batchDeleteCollectionsMutation.mutate(selectedCollectionIdsForDelete)}
        onOpenChange={setShowBatchDeleteDialog}
        open={showBatchDeleteDialog}
        title={t("taxonomy.delete.batchTitle", {
          entityPlural: t("taxonomy.entity.collection.plural"),
        })}
      />
    </>
  );
}
