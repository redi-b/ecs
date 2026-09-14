"use client";

import type { MerchantProduct } from "@ecs/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/app/access-context";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import {
  type DataTableFilterDefinition,
  DataTableFilters,
} from "@/components/app/data-table-filters";
import { AppIcons } from "@/components/app/icons";
import { ListResultsStatus } from "@/components/app/list-results-status";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BulkInventoryDialog } from "@/features/products/bulk-inventory-dialog";
import {
  getProductTableCounts,
  type ProductMediaFilter,
  type ProductStatusFilter,
} from "@/features/products/product-table-state";
import { useProductTaxonomy } from "@/features/products/use-product-taxonomy";
import { copyTextToClipboard } from "@/lib/clipboard";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type ProductsTableProps = {
  footer?: ReactNode;
  initialCategoryId?: string | undefined;
  initialCollectionId?: string | undefined;
  initialMedia?: ProductMediaFilter | undefined;
  initialQuery?: string | undefined;
  initialStatus?: ProductStatusFilter | undefined;
  pageSize: number;
  products: MerchantProduct[];
  productDetailHrefBase?: string | undefined;
  readOnly?: boolean | undefined;
  tenantId?: string | undefined;
  totalCount: number;
};

import {
  getDeletionErrorMessage,
  getProductColumns,
  getProductStatusFilterOptions,
  getStatusLoadingMessage,
  getStatusSuccessMessage,
  type ProductStatusValue,
  setUrlFilter,
} from "@/features/products/products-table-helpers";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";

async function copyToClipboard(
  value: string,
  label: string,
  t: (key: MessageKey, values?: Record<string, string | number>) => string,
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

export function ProductsTable({
  footer,
  initialCategoryId = "all",
  initialCollectionId = "all",
  initialMedia = "all",
  initialQuery = "",
  initialStatus = "all",
  pageSize,
  products,
  productDetailHrefBase,
  readOnly = false,
  tenantId,
  totalCount,
}: ProductsTableProps) {
  const { t } = useI18n();
  const canUpdate = usePermission("products.update") && !readOnly;
  const canDelete = usePermission("products.delete") && !readOnly;
  const canPublish = usePermission("products.publish") && !readOnly;
  const router = useRouter();
  const queryClient = useQueryClient();
  const taxonomy = useProductTaxonomy({ enabled: canUpdate, tenantId });
  const categories = taxonomy.categories;
  const collections = taxonomy.collections;
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(initialQuery);
  // Stock remains page-local until its backend availability query is implemented.
  const media = initialMedia;
  void pageSize;

  useEffect(() => {
    setSearchValue(initialQuery);
  }, [initialQuery]);

  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [selectedProductIdsForDelete, setSelectedProductIdsForDelete] = useState<string[]>([]);
  const [selectedProductsForInventory, setSelectedProductsForInventory] = useState<
    MerchantProduct[]
  >([]);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const [showBulkInventoryDialog, setShowBulkInventoryDialog] = useState(false);

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const url = getTenantScopedPath(dashboardRoutes.productDeleteAction(productId), tenantId);
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("products.table.toastDeleteFailed"));
      }
      return productId;
    },
    onSuccess: () => {
      toast.success(t("products.table.toastDeletedOne"));
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteProductId(null);
      router.refresh();
    },
    onError: (error) => {
      toast.error(getDeletionErrorMessage(error, t("nav.products")));
    },
  });

  const batchDeleteProductsMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      const url = getTenantScopedPath(dashboardRoutes.productsBatchDeleteAction, tenantId);
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("products.table.toastDeleteManyFailed"));
      }
      return productIds;
    },
    onSuccess: () => {
      toast.success(t("products.table.toastDeletedMany"));
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedProductIdsForDelete([]);
      setShowBatchDeleteDialog(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(getDeletionErrorMessage(error, t("nav.products")));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      productIds,
      status,
    }: {
      productIds: string[];
      status: ProductStatusValue;
    }) => {
      await Promise.all(
        productIds.map(async (productId) => {
          const url = getTenantScopedPath(dashboardRoutes.productUpdateAction(productId), tenantId);
          const res = await fetch(url, {
            body: JSON.stringify({ status }),
            headers: {
              accept: "application/json",
              "content-type": "application/json",
            },
            method: "POST",
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || t("products.table.toastStatusFailed"));
          }
        }),
      );

      return { count: productIds.length, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      router.refresh();
    },
  });
  const { isPending: isStatusUpdatePending, mutateAsync: updateProductStatus } =
    updateStatusMutation;
  const handleStatusChange = useCallback(
    (productIds: string[], nextStatus: ProductStatusValue) => {
      return toast.promise(updateProductStatus({ productIds, status: nextStatus }), {
        error: t("products.table.statusUpdateFailed"),
        loading: getStatusLoadingMessage(productIds.length, nextStatus, t),
        success: ({ count, status }) => getStatusSuccessMessage(count, status, t),
      });
    },
    [t, updateProductStatus],
  );

  const columns = useMemo(() => {
    const resolved = getProductColumns(
      tenantId,
      categories,
      collections,
      canDelete ? (id) => setDeleteProductId(id) : undefined,
      handleStatusChange,
      t,
      productDetailHrefBase
        ? (product) => `${productDetailHrefBase}/${encodeURIComponent(product.id)}`
        : undefined,
      canUpdate && !tenantId
        ? (product) => {
            setSelectedProductsForInventory([product]);
            setShowBulkInventoryDialog(true);
          }
        : undefined,
    );
    return resolved;
  }, [
    canDelete,
    canUpdate,
    categories,
    collections,
    handleStatusChange,
    productDetailHrefBase,
    t,
    tenantId,
  ]);

  const pushServerFilters = useCallback(
    (
      next: Partial<{
        q: string;
        status: ProductStatusFilter;
        collectionId: string;
        categoryId: string;
        media: ProductMediaFilter;
      }>,
    ) => {
      const url = new URL(window.location.href);
      const q = next.q !== undefined ? next.q : initialQuery;
      const status = next.status !== undefined ? next.status : initialStatus;
      const collectionId =
        next.collectionId !== undefined ? next.collectionId : initialCollectionId;
      const categoryId = next.categoryId !== undefined ? next.categoryId : initialCategoryId;

      if (q.trim()) url.searchParams.set("q", q.trim());
      else url.searchParams.delete("q");

      setUrlFilter(url, "status", status, "all");
      setUrlFilter(url, "collectionId", collectionId, "all");
      setUrlFilter(url, "categoryId", categoryId, "all");
      url.searchParams.delete("stock");
      setUrlFilter(url, "media", next.media ?? media, "all");
      // Retired page-local variant-count filter: do not carry old bookmarks forward.
      url.searchParams.delete("variantCount");
      url.searchParams.delete("page");

      startTransition(() => {
        router.push(`${url.pathname}?${url.searchParams.toString()}`);
      });
    },
    [initialCategoryId, initialCollectionId, initialQuery, initialStatus, media, router],
  );

  // All exposed filters are applied by the server before pagination.
  const filteredProducts = products;
  const counts = getProductTableCounts({
    filteredCount: filteredProducts.length,
    pageCount: products.length,
    totalCount,
    filters: {
      categoryId: initialCategoryId,
      collectionId: initialCollectionId,
      media,
      query: initialQuery,
      status: initialStatus,
    },
  });
  const hasClientPageFilter = false;
  const hasServerFilter =
    media !== "all" ||
    Boolean(initialQuery.trim()) ||
    initialStatus !== "all" ||
    initialCollectionId !== "all" ||
    initialCategoryId !== "all";

  const filters: DataTableFilterDefinition[] = [
    {
      defaultValue: "all",
      id: "status",
      label: t("products.filter.status.label"),
      onChange: (value) => pushServerFilters({ status: value as ProductStatusFilter }),
      options: getProductStatusFilterOptions(t),
      value: initialStatus,
    },
    {
      defaultValue: "all",
      id: "media",
      label: t("products.filter.media.label"),
      onChange: (value) => pushServerFilters({ media: value as ProductMediaFilter }),
      options: [
        { label: t("products.filter.media.all"), value: "all" },
        { label: t("products.filter.media.with_media"), value: "with_media" },
        { label: t("products.filter.media.without_media"), value: "without_media" },
      ],
      value: media,
    },
    {
      defaultValue: "all",
      id: "collectionId",
      label: t("products.filter.collection.label"),
      onChange: (value) => pushServerFilters({ collectionId: value }),
      options: [
        { label: t("products.filter.collection.all"), value: "all" },
        { label: t("products.filter.collection.none"), value: "none" },
        ...collections.map((collection) => ({
          label: collection.title ?? collection.handle ?? collection.id,
          value: collection.id,
        })),
      ],
      value: initialCollectionId,
    },
    {
      defaultValue: "all",
      id: "categoryId",
      label: t("products.filter.category.label"),
      onChange: (value) => pushServerFilters({ categoryId: value }),
      options: [
        { label: t("products.filter.category.all"), value: "all" },
        { label: t("products.filter.category.none"), value: "none" },
        ...categories.map((category) => ({
          label: category.name ?? category.handle ?? category.id,
          value: category.id,
        })),
      ],
      value: initialCategoryId,
    },
  ];

  function clearFilters() {
    setSearchValue("");

    const url = new URL(window.location.href);
    for (const key of [
      "q",
      "status",
      "collectionId",
      "categoryId",
      "stock",
      "media",
      "variantCount",
      "page",
    ]) {
      url.searchParams.delete(key);
    }

    startTransition(() => {
      router.push(`${url.pathname}?${url.searchParams.toString()}`);
    });
  }

  const toolbar = (
    <div className="flex flex-col gap-3">
      <DataTableFilters filters={filters} onClearAll={clearFilters}>
        <ListToolbarSearch
          clearLabel={t("common.clearSearch")}
          label={t("products.table.searchLabel")}
          onChange={(value) => {
            setSearchValue(value);
            pushServerFilters({ q: value });
          }}
          placeholder={t("products.table.searchPlaceholder")}
          value={searchValue}
        />
      </DataTableFilters>
      {taxonomy.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            {t(
              taxonomy.errorLabels.length > 1
                ? "products.filter.taxonomyError"
                : taxonomy.errorLabels.includes("categories")
                  ? "products.filter.categoriesError"
                  : "products.filter.collectionsError",
            )}
            <Button type="button" variant="outline" size="sm" onClick={taxonomy.retry}>
              {t("common.tryAgain")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <ListResultsStatus
        filteredPageCount={counts.filteredCount}
        hasClientPageFilter={hasClientPageFilter}
        hasServerFilter={hasServerFilter}
        pageCount={products.length}
        pending={pending}
        totalCount={totalCount}
      />
    </div>
  );

  const productToDelete = products.find((p) => p.id === deleteProductId);

  return (
    <>
      <DataTable
        bulkActions={(selectedProducts) => (
          <>
            <Button
              onClick={() =>
                void copyToClipboard(
                  selectedProducts.map((product) => product.id).join("\n"),
                  t("products.table.productIds"),
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
            {canPublish ? (
              <>
                <Button
                  disabled={isStatusUpdatePending}
                  onClick={() =>
                    handleStatusChange(
                      selectedProducts.map((product) => product.id),
                      "published",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("table.actions.publish")}
                </Button>
                <Button
                  disabled={isStatusUpdatePending}
                  onClick={() =>
                    handleStatusChange(
                      selectedProducts.map((product) => product.id),
                      "draft",
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("table.actions.moveToDraft")}
                </Button>
              </>
            ) : null}
            {canUpdate && !tenantId ? (
              <Button
                onClick={() => {
                  setSelectedProductsForInventory(selectedProducts);
                  setShowBulkInventoryDialog(true);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("products.stock.bulkAction")}
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                onClick={() => {
                  setSelectedProductIdsForDelete(selectedProducts.map((p) => p.id));
                  setShowBatchDeleteDialog(true);
                }}
                size="sm"
                type="button"
                variant="destructive-outline"
              >
                <AppIcons.trash data-icon="inline-start" />
                {t("table.actions.deleteSelected")}
              </Button>
            ) : null}
          </>
        )}
        columns={columns}
        data={filteredProducts}
        enableSorting={false}
        emptyIcon={<AppIcons.products className="size-5" aria-hidden />}
        emptyMessage={t("products.table.emptyMessage")}
        emptyTitle={t("products.table.emptyTitle")}
        filteredEmptyMessage={t("products.table.filteredEmptyMessage")}
        filteredEmptyTitle={t("products.table.filteredEmptyTitle")}
        getRowId={(product) => product.id}
        isFiltered={counts.hasActiveFilter}
        isLoading={pending}
        skeletonShowMedia
        selectedSummaryLabel={t("products.table.selectedSummary")}
        toolbar={toolbar}
        footer={footer}
      />

      <BulkInventoryDialog
        onOpenChange={setShowBulkInventoryDialog}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
          router.refresh();
        }}
        open={showBulkInventoryDialog}
        products={selectedProductsForInventory}
      />

      <ConfirmDialog
        cancelDisabled={deleteProductMutation.isPending}
        confirmDisabled={deleteProductMutation.isPending}
        confirmLabel={deleteProductMutation.isPending ? t("common.deleting") : t("common.delete")}
        description={t("products.detail.deleteDesc", {
          title: productToDelete?.title || t("products.detail.thisProduct"),
        })}
        eyebrow={t("common.confirm.deleteEyebrow")}
        icon="trash"
        onConfirm={() => {
          if (deleteProductId) deleteProductMutation.mutate(deleteProductId);
        }}
        onOpenChange={(open) => {
          if (!open) setDeleteProductId(null);
        }}
        open={deleteProductId !== null}
        title={t("products.detail.deleteTitle")}
      />

      <ConfirmDialog
        cancelDisabled={batchDeleteProductsMutation.isPending}
        confirmDisabled={batchDeleteProductsMutation.isPending}
        confirmLabel={
          batchDeleteProductsMutation.isPending ? t("common.deleting") : t("common.delete")
        }
        description={t("products.table.deleteBatchDesc", {
          count: selectedProductIdsForDelete.length,
        })}
        eyebrow={t("common.confirm.deleteEyebrow")}
        icon="trash"
        onConfirm={() => batchDeleteProductsMutation.mutate(selectedProductIdsForDelete)}
        onOpenChange={setShowBatchDeleteDialog}
        open={showBatchDeleteDialog}
        title={t("products.table.deleteProducts")}
      />
    </>
  );
}
