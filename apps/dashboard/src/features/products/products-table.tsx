"use client";

import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
} from "@ecs/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import {
  type DataTableFilterDefinition,
  DataTableFilters,
} from "@/components/app/data-table-filters";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatProductDate,
  formatProductPriceRange,
  ProductIdentityCell,
  ProductMediaSignal,
  ProductStatusBadge,
} from "@/features/products/product-table-cells";
import {
  filterProductsForTable,
  getProductMediaCount,
  getProductPriceSortValue,
  getProductTableCounts,
  normalizeProductStatus,
  type ProductStatusFilter,
  type ProductMediaFilter,
  type ProductStockFilter,
  type ProductVariantCountFilter,
} from "@/features/products/product-table-state";
import { copyTextToClipboard } from "@/lib/clipboard";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type ProductsTableProps = {
  categories: MerchantProductCategory[];
  collections: MerchantProductCollection[];
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

const productStatusFilterOptions: Array<{
  label: string;
  value: ProductStatusFilter;
}> = [
  { label: "All statuses", value: "all" },
  { label: "Published", value: "published" },
  { label: "Draft", value: "draft" },
  { label: "Unknown", value: "unknown" },
];

type ProductStatusValue = "draft" | "published";

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

function setUrlFilter(url: URL, key: string, value: string, defaultValue: string) {
  if (value !== defaultValue) {
    url.searchParams.set(key, value);
  } else {
    url.searchParams.delete(key);
  }
}

function getProductColumns(
  tenantId: string | null | undefined,
  categories: MerchantProductCategory[],
  collections: MerchantProductCollection[],
  onDelete: (productId: string) => void,
  onStatusChange: (productIds: string[], status: ProductStatusValue) => void,
): ColumnDef<MerchantProduct>[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));

  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all visible products"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.title ?? row.original.id}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      accessorKey: "title",
      header: ({ column }) => <DataTableHeader column={column} title="Product" />,
      cell: ({ row }) => (
        <ProductIdentityCell product={row.original} tenantId={tenantId ?? undefined} />
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableHeader column={column} title="Status" />,
      cell: ({ row }) => <ProductStatusBadge status={row.original.status} />,
    },
    {
      id: "price",
      accessorFn: (product) => getProductPriceSortValue(product),
      header: ({ column }) => <DataTableHeader column={column} title="Price" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatProductPriceRange(row.original)}</span>
      ),
    },
    {
      id: "variants",
      accessorFn: (product) => product.variants?.length ?? 0,
      header: ({ column }) => <DataTableHeader column={column} title="Variants" />,
      cell: ({ row }) => {
        const variantCount = row.original.variants?.length ?? 0;

        return (
          <span className="text-muted-foreground">
            {variantCount} variant{variantCount === 1 ? "" : "s"}
          </span>
        );
      },
    },
    {
      id: "stock",
      accessorFn: (product) => getProductStockSortValue(product),
      header: ({ column }) => <DataTableHeader column={column} title="Stock" />,
      cell: ({ row }) => <ProductStockSummary product={row.original} />,
    },
    {
      id: "organization",
      accessorFn: (product) =>
        [
          product.collectionId ? collectionById.get(product.collectionId)?.title ?? product.collectionId : "",
          ...(product.categoryIds ?? []).map((id) => categoryById.get(id)?.name ?? id),
        ].join(" "),
      header: ({ column }) => <DataTableHeader column={column} title="Organization" />,
      cell: ({ row }) => (
        <ProductOrganizationSummary
          categoryById={categoryById}
          collectionById={collectionById}
          product={row.original}
        />
      ),
    },
    {
      id: "media",
      accessorFn: (product) => getProductMediaCount(product),
      header: ({ column }) => <DataTableHeader column={column} title="Media" />,
      cell: ({ row }) => <ProductMediaSignal product={row.original} />,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => <DataTableHeader column={column} title="Updated" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatProductDate(row.original.updatedAt)}</span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const product = row.original;
        const href = getTenantScopedPath(dashboardRoutes.productDetail(product.id), tenantId);
        const normalizedStatus = normalizeProductStatus(product.status);
        const nextStatus = normalizedStatus === "published" ? "draft" : "published";

        return (
          <RowActionsMenu
            actions={[
              { href, label: "View details", type: "link" },
              { href, label: "Manage inventory", type: "link" },
              {
                label: nextStatus === "published" ? "Publish product" : "Move to draft",
                onSelect: () => onStatusChange([product.id], nextStatus),
                type: "button",
              },
              { id: "identity", type: "separator" },
              {
                label: "Copy product ID",
                onSelect: () => copyToClipboard(product.id, "Product ID"),
                type: "button",
              },
              {
                disabled: !product.handle,
                label: "Copy handle",
                onSelect: () => copyToClipboard(product.handle ?? "", "Handle"),
                type: "button",
              },
              {
                disabled: !product.handle,
                label: "Copy storefront path",
                onSelect: () =>
                  copyToClipboard(product.handle ? `/products/${product.handle}` : "", "Product path"),
                type: "button",
              },
              { id: "danger", type: "separator" },
              {
                label: "Delete product",
                onSelect: () => onDelete(product.id),
                type: "button",
                variant: "destructive",
              },
            ]}
            label={`Open actions for ${product.title || "unnamed product"}`}
          />
        );
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];
}

function ProductStockSummary({ product }: { product: MerchantProduct }) {
  const variants = product.variants ?? [];
  const stocks = variants.map((variant) => variant.stock).filter(isProductStock);

  if (!stocks.length) {
    return <Badge variant="outline">Not tracked</Badge>;
  }

  const available = stocks.reduce(
    (total, stock) => total + (stock.availableQuantity ?? stock.stockedQuantity ?? 0),
    0,
  );

  return (
    <Badge variant={available > 0 ? "default" : "secondary"}>
      {available > 0 ? `${available} available` : "Out of stock"}
    </Badge>
  );
}

function ProductOrganizationSummary({
  categoryById,
  collectionById,
  product,
}: {
  categoryById: Map<string, MerchantProductCategory>;
  collectionById: Map<string, MerchantProductCollection>;
  product: MerchantProduct;
}) {
  const collection = product.collectionId ? collectionById.get(product.collectionId) : undefined;
  const categoryIds = product.categoryIds ?? [];
  const categoryCount = categoryIds.length;
  const firstCategory = categoryIds[0] ? categoryById.get(categoryIds[0]) : undefined;

  if (!product.collectionId && !categoryCount) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <AppIcons.folder className="size-4" />
            <AppIcons.tag className="size-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>No collection or categories</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex min-w-36 flex-col gap-1.5">
      <OrganizationSignal
        icon={<AppIcons.folder className="size-4" />}
        tooltip="Collection"
        value={
          product.collectionId
            ? collection?.title ?? collection?.handle ?? product.collectionId
            : "No collection"
        }
      />
      <OrganizationSignal
        icon={<AppIcons.tag className="size-4" />}
        tooltip="Categories"
        value={
          categoryCount
            ? `${firstCategory?.name ?? firstCategory?.handle ?? categoryIds[0]}${
                categoryCount > 1 ? ` +${categoryCount - 1}` : ""
              }`
            : "No categories"
        }
      />
    </div>
  );
}

function OrganizationSignal({
  icon,
  tooltip,
  value,
}: {
  icon: ReactNode;
  tooltip: string;
  value: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm">
          <span className="shrink-0 text-muted-foreground">{icon}</span>
          <span className="truncate">{value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {tooltip}: {value}
      </TooltipContent>
    </Tooltip>
  );
}

function getProductStockSortValue(product: MerchantProduct) {
  const stocks = (product.variants ?? []).map((variant) => variant.stock).filter(isProductStock);

  if (!stocks.length) {
    return -1;
  }

  return stocks.reduce(
    (total, stock) => total + (stock.availableQuantity ?? stock.stockedQuantity ?? 0),
    0,
  );
}

function isProductStock(
  stock: NonNullable<MerchantProduct["variants"]>[number]["stock"] | null | undefined,
): stock is NonNullable<NonNullable<MerchantProduct["variants"]>[number]["stock"]> {
  return Boolean(stock);
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

function getStatusLoadingMessage(count: number, status: ProductStatusValue) {
  const productLabel = count === 1 ? "product" : "products";

  return status === "published"
    ? `Publishing ${count} ${productLabel}...`
    : `Moving ${count} ${productLabel} to draft...`;
}

function getStatusSuccessMessage(count: number, status: ProductStatusValue) {
  const productLabel = count === 1 ? "product" : "products";

  return status === "published"
    ? `${count} ${productLabel} published.`
    : `${count} ${productLabel} moved to draft.`;
}

export function ProductsTable({
  categories,
  collections,
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<ProductStatusFilter>(initialStatus);
  const [stock, setStock] = useState<ProductStockFilter>(initialStock);
  const [media, setMedia] = useState<ProductMediaFilter>(initialMedia);
  const [variantCount, setVariantCount] =
    useState<ProductVariantCountFilter>(initialVariantCount);
  const [collectionId, setCollectionId] = useState(initialCollectionId);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const hasSyncedInitialUrlState = useRef(false);
  void pageSize;

  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [selectedProductIdsForDelete, setSelectedProductIdsForDelete] = useState<string[]>([]);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const url = getTenantScopedPath(dashboardRoutes.productDeleteAction(productId), tenantId);
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete product.");
      }
      return productId;
    },
    onSuccess: () => {
      toast.success("Product deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteProductId(null);
      router.refresh();
    },
    onError: (error) => {
      toast.error(getDeletionErrorMessage(error, "Product"));
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
        throw new Error(err.error || "Failed to delete products.");
      }
      return productIds;
    },
    onSuccess: () => {
      toast.success("Selected products deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedProductIdsForDelete([]);
      setShowBatchDeleteDialog(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(getDeletionErrorMessage(error, "Products"));
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
            throw new Error(err.error || "Failed to update product status.");
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
        error: "Product status could not be updated. Try again.",
        loading: getStatusLoadingMessage(productIds.length, nextStatus),
        success: ({ count, status }) => getStatusSuccessMessage(count, status),
      });
    },
    [updateProductStatus],
  );

  const columns = useMemo(
    () =>
      getProductColumns(
        tenantId,
        categories,
        collections,
        (id) => setDeleteProductId(id),
        handleStatusChange,
      ),
    [categories, collections, handleStatusChange, tenantId],
  );

  const filteredProducts = useMemo(
    () =>
      filterProductsForTable(products, {
        categoryId,
        collectionId,
        media,
        query,
        status,
        stock,
        variantCount,
      }),
    [products, categoryId, collectionId, media, query, status, stock, variantCount],
  );
  const counts = getProductTableCounts({
    filteredCount: filteredProducts.length,
    pageCount: products.length,
    totalCount,
    filters: { categoryId, collectionId, media, query, status, stock, variantCount },
  });
  const filters: DataTableFilterDefinition[] = [
    {
      defaultValue: "all",
      id: "status",
      label: "Status",
      onChange: (value) => setStatus(value as ProductStatusFilter),
      options: productStatusFilterOptions,
      value: status,
    },
    {
      defaultValue: "all",
      id: "stock",
      label: "Stock",
      onChange: (value) => setStock(value as ProductStockFilter),
      options: [
        { label: "All stock", value: "all" },
        { label: "In stock", value: "in_stock" },
        { label: "Out of stock", value: "out_of_stock" },
        { label: "Not tracked", value: "not_tracked" },
      ],
      value: stock,
    },
    {
      defaultValue: "all",
      id: "media",
      label: "Media",
      onChange: (value) => setMedia(value as ProductMediaFilter),
      options: [
        { label: "All media", value: "all" },
        { label: "With media", value: "with_media" },
        { label: "Without media", value: "without_media" },
      ],
      value: media,
    },
    {
      defaultValue: "all",
      id: "variantCount",
      label: "Variants",
      onChange: (value) => setVariantCount(value as ProductVariantCountFilter),
      options: [
        { label: "All variant counts", value: "all" },
        { label: "No variants", value: "no_variants" },
        { label: "Single variant", value: "single_variant" },
        { label: "Multiple variants", value: "multi_variant" },
      ],
      value: variantCount,
    },
    {
      defaultValue: "all",
      id: "collectionId",
      label: "Collection",
      onChange: setCollectionId,
      options: [
        { label: "All collections", value: "all" },
        { label: "No collection", value: "none" },
        ...collections.map((collection) => ({
          label: collection.title ?? collection.handle ?? collection.id,
          value: collection.id,
        })),
      ],
      value: collectionId,
    },
    {
      defaultValue: "all",
      id: "categoryId",
      label: "Category",
      onChange: setCategoryId,
      options: [
        { label: "All categories", value: "all" },
        { label: "No category", value: "none" },
        ...categories.map((category) => ({
          label: category.name ?? category.handle ?? category.id,
          value: category.id,
        })),
      ],
      value: categoryId,
    },
  ];

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setStock("all");
    setMedia("all");
    setVariantCount("all");
    setCollectionId("all");
    setCategoryId("all");
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasSyncedInitialUrlState.current) {
      hasSyncedInitialUrlState.current = true;
      return;
    }

    const url = new URL(window.location.href);

    if (query.trim()) {
      url.searchParams.set("q", query.trim());
    } else {
      url.searchParams.delete("q");
    }

    if (status !== "all") {
      url.searchParams.set("status", status);
    } else {
      url.searchParams.delete("status");
    }

    setUrlFilter(url, "stock", stock, "all");
    setUrlFilter(url, "media", media, "all");
    setUrlFilter(url, "variantCount", variantCount, "all");
    setUrlFilter(url, "collectionId", collectionId, "all");
    setUrlFilter(url, "categoryId", categoryId, "all");

    url.searchParams.delete("page");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [categoryId, collectionId, media, query, status, stock, variantCount]);

  const toolbar = (
    <div className="flex flex-col gap-3">
      <DataTableFilters filters={filters} onClearAll={clearFilters}>
        <InputGroup className="h-10 rounded-full bg-background/70 px-1 sm:max-w-sm">
          <InputGroupAddon>
            <AppIcons.search data-icon="inline-start" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search products"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            value={query}
          />
          {query.trim() ? (
            <InputGroupAddon align="inline-end">
              <Button
                aria-label="Clear product search"
                className="rounded-full"
                onClick={() => setQuery("")}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <AppIcons.close data-icon="inline-start" />
              </Button>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </DataTableFilters>
      <p className="text-sm text-muted-foreground">
        {counts.hasActiveFilter
          ? `${counts.filteredCount} of ${counts.pageCount} on this page`
          : `${counts.pageCount} on this page, ${counts.totalCount} total`}
      </p>
    </div>
  );

  const productToDelete = products.find((p) => p.id === deleteProductId);

  return (
    <>
      <DataTable
        bulkActions={(selectedProducts) => (
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                copyToClipboard(selectedProducts.map((product) => product.id).join("\n"), "Product IDs")
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <AppIcons.copy data-icon="inline-start" />
              Copy IDs
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
              Publish
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
              Move to draft
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
              Delete selected
            </Button>
          </div>
        )}
        columns={columns}
        data={filteredProducts}
        emptyMessage="No products have been synced for this merchant yet."
        emptyTitle="No products yet"
        filteredEmptyMessage="No products match the current search or filters."
        filteredEmptyTitle="No matching products"
        getRowId={(product) => product.id}
        isFiltered={counts.hasActiveFilter}
        selectedSummaryLabel={(count) => `product${count === 1 ? "" : "s"} selected`}
        toolbar={toolbar}
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
              {deleteProductMutation.isPending ? "Deleting..." : "Delete"}
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
              {batchDeleteProductsMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
