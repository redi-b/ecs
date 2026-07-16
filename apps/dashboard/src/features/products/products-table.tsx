"use client";

import type { MerchantProduct } from "@ecs/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import {
  type DataTableFilterDefinition,
  DataTableFilters,
} from "@/components/app/data-table-filters";
import { AppIcons } from "@/components/app/icons";
import { ListResultsStatus } from "@/components/app/list-results-status";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
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
import {
  filterProductsForTable,
  getProductTableCounts,
  type ProductMediaFilter,
  type ProductStatusFilter,
  type ProductStockFilter,
  type ProductVariantCountFilter,
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
  initialStock?: ProductStockFilter | undefined;
  initialVariantCount?: ProductVariantCountFilter | undefined;
  pageSize: number;
  products: MerchantProduct[];
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

export function ProductsTable({
  footer,
  initialCategoryId = "all",
  initialCollectionId = "all",
  initialMedia = "all",
  initialQuery = "",
  initialStatus = "all",
  initialStock = "all",
  initialVariantCount = "all",
  pageSize,
  products,
  tenantId,
  totalCount,
}: ProductsTableProps) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const taxonomy = useProductTaxonomy({ tenantId });
  const categories = taxonomy.categories;
  const collections = taxonomy.collections;
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(initialQuery);
  // Stock / media / variants stay client-side on the current server page (phase-2 candidates).
  const [stock, setStock] = useState<ProductStockFilter>(initialStock);
  const [media, setMedia] = useState<ProductMediaFilter>(initialMedia);
  const [variantCount, setVariantCount] = useState<ProductVariantCountFilter>(initialVariantCount);
  void pageSize;

  useEffect(() => {
    setSearchValue(initialQuery);
  }, [initialQuery]);

  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [selectedProductIdsForDelete, setSelectedProductIdsForDelete] = useState<string[]>([]);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

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

  const columns = useMemo(
    () =>
      getProductColumns(
        tenantId,
        categories,
        collections,
        (id) => setDeleteProductId(id),
        handleStatusChange,
        t,
      ),
    [categories, collections, handleStatusChange, t, tenantId],
  );

  const pushServerFilters = useCallback(
    (
      next: Partial<{
        q: string;
        status: ProductStatusFilter;
        collectionId: string;
        categoryId: string;
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
      // Preserve client-only filters in the URL for bookmarking.
      setUrlFilter(url, "stock", stock, "all");
      setUrlFilter(url, "media", media, "all");
      setUrlFilter(url, "variantCount", variantCount, "all");
      url.searchParams.delete("page");

      startTransition(() => {
        router.push(`${url.pathname}?${url.searchParams.toString()}`);
      });
    },
    [
      initialCategoryId,
      initialCollectionId,
      initialQuery,
      initialStatus,
      media,
      router,
      stock,
      variantCount,
    ],
  );

  const setClientFilter = useCallback(
    (key: "stock" | "media" | "variantCount", value: string) => {
      if (key === "stock") setStock(value as ProductStockFilter);
      if (key === "media") setMedia(value as ProductMediaFilter);
      if (key === "variantCount") setVariantCount(value as ProductVariantCountFilter);

      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      setUrlFilter(url, key, value, "all");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    },
    [],
  );

  // Server already applied q/status/collection/category — only refine the page locally.
  const filteredProducts = useMemo(
    () =>
      filterProductsForTable(products, {
        categoryId: "all",
        collectionId: "all",
        media,
        query: "",
        status: "all",
        stock,
        variantCount,
      }),
    [products, media, stock, variantCount],
  );
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
      stock,
      variantCount,
    },
  });
  const hasClientPageFilter =
    stock !== "all" || media !== "all" || variantCount !== "all";
  const hasServerFilter =
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
      id: "stock",
      label: t("products.filter.stock.label"),
      onChange: (value) => setClientFilter("stock", value),
      options: [
        { label: t("products.filter.stock.all"), value: "all" },
        { label: t("products.filter.stock.in_stock"), value: "in_stock" },
        { label: t("products.filter.stock.out_of_stock"), value: "out_of_stock" },
        { label: t("products.filter.stock.not_tracked"), value: "not_tracked" },
      ],
      value: stock,
    },
    {
      defaultValue: "all",
      id: "media",
      label: t("products.filter.media.label"),
      onChange: (value) => setClientFilter("media", value),
      options: [
        { label: t("products.filter.media.all"), value: "all" },
        { label: t("products.filter.media.with_media"), value: "with_media" },
        { label: t("products.filter.media.without_media"), value: "without_media" },
      ],
      value: media,
    },
    {
      defaultValue: "all",
      id: "variantCount",
      label: t("products.filter.variants.label"),
      onChange: (value) => setClientFilter("variantCount", value),
      options: [
        { label: t("products.filter.variants.all"), value: "all" },
        { label: t("products.filter.variants.no_variants"), value: "no_variants" },
        { label: t("products.filter.variants.single_variant"), value: "single_variant" },
        { label: t("products.filter.variants.multi_variant"), value: "multi_variant" },
      ],
      value: variantCount,
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
    setStock("all");
    setMedia("all");
    setVariantCount("all");
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
          clearLabel={t("products.table.clearSearch")}
          label={t("products.table.searchLabel")}
          onChange={(value) => {
            setSearchValue(value);
            pushServerFilters({ q: value });
          }}
          placeholder={t("products.table.searchPlaceholder")}
          value={searchValue}
        />
      </DataTableFilters>
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
            <Button
              onClick={() => {
                setSelectedProductIdsForDelete(selectedProducts.map((p) => p.id));
                setShowBatchDeleteDialog(true);
              }}
              size="sm"
              type="button"
              variant="destructive"
            >
              <AppIcons.trash data-icon="inline-start" />
              Delete
            </Button>
          </>
        )}
        columns={columns}
        data={filteredProducts}
        emptyMessage={t("table.empty.noItems")}
        emptyTitle={t("table.empty.noItemsTitle")}
        filteredEmptyMessage={t("table.empty.filteredNoItems")}
        filteredEmptyTitle={t("table.empty.filteredNoItemsTitle")}
        getRowId={(product) => product.id}
        isFiltered={counts.hasActiveFilter}
        selectedSummaryLabel={(count) => `product${count === 1 ? "" : "s"} selected`}
        toolbar={toolbar}
        footer={footer}
      />

      <AlertDialog
        open={deleteProductId !== null}
        onOpenChange={(open) => !open && setDeleteProductId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{productToDelete?.title || "this product"}
              &rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProductMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={deleteProductMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteProductId) deleteProductMutation.mutate(deleteProductId);
              }}
            >
              {deleteProductMutation.isPending ? t("common.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete products</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedProductIdsForDelete.length} selected
              products? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleteProductsMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={batchDeleteProductsMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                batchDeleteProductsMutation.mutate(selectedProductIdsForDelete);
              }}
            >
              {batchDeleteProductsMutation.isPending ? t("common.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
