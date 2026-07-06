"use client";

import type { MerchantProduct } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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

import { DataTable } from "@/components/app/data-table";
import {
  DataTableFilters,
  type DataTableFilterDefinition,
} from "@/components/app/data-table-filters";
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
  formatProductDate,
  formatProductFirstPrice,
  ProductIdentityCell,
  ProductMediaSignal,
  ProductStatusBadge,
} from "@/features/products/product-table-cells";
import {
  filterProductsForTable,
  getProductMediaCount,
  getProductPriceSortValue,
  getProductTableCounts,
  type ProductStatusFilter,
} from "@/features/products/product-table-state";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type ProductsTableProps = {
  initialQuery?: string | undefined;
  initialStatus?: ProductStatusFilter | undefined;
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

function copyToClipboard(value: string) {
  if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(value).catch(() => undefined);
}

function getProductColumns(
  tenantId: string | null | undefined,
  onDelete: (productId: string) => void,
): ColumnDef<MerchantProduct>[] {
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
      cell: ({ row }) => <ProductIdentityCell product={row.original} tenantId={tenantId ?? undefined} />,
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
        <span className="text-muted-foreground">{formatProductFirstPrice(row.original)}</span>
      ),
    },
    {
      id: "variants",
      accessorFn: (product) => product.variants?.length ?? 0,
      header: ({ column }) => <DataTableHeader column={column} title="Variants" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.variants?.length ?? 0}</span>
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

        return (
          <RowActionsMenu
            actions={[
              { href, label: "View details", type: "link" },
              { type: "separator" },
              {
                label: "Copy product ID",
                onSelect: () => copyToClipboard(product.id),
                type: "button",
              },
              {
                disabled: !product.handle,
                label: "Copy handle",
                onSelect: () => copyToClipboard(product.handle ?? ""),
                type: "button",
              },
              { type: "separator" },
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

function getDeletionErrorMessage(error: unknown, resourceName: string) {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "commerce_backend_unavailable") {
    return "Catalog changes are temporarily unavailable. Try again.";
  }
  if (code === "commerce_credentials_missing" || code === "commerce_credentials_invalid") {
    return "Catalog changes are temporarily unavailable. Contact support.";
  }
  if (code === "product_not_found" || code === "category_not_found" || code === "collection_not_found") {
    return `${resourceName} not found.`;
  }
  return `Failed to delete ${resourceName.toLowerCase()}. Try again.`;
}

export function ProductsTable({
  initialQuery = "",
  initialStatus = "all",
  pageSize,
  products,
  tenantId,
  totalCount,
}: ProductsTableProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<ProductStatusFilter>(initialStatus);
  const hasSyncedInitialUrlState = useRef(false);
  void pageSize;

  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [selectedProductIdsForDelete, setSelectedProductIdsForDelete] = useState<string[]>([]);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  const columns = useMemo(
    () => getProductColumns(tenantId, (id) => setDeleteProductId(id)),
    [tenantId],
  );

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

  const filteredProducts = useMemo(
    () => filterProductsForTable(products, { query, status }),
    [products, query, status],
  );
  const counts = getProductTableCounts({
    filteredCount: filteredProducts.length,
    pageCount: products.length,
    totalCount,
    filters: { query, status },
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
  ];

  function clearFilters() {
    setQuery("");
    setStatus("all");
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

    url.searchParams.delete("page");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [query, status]);

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
                copyToClipboard(selectedProducts.map((product) => product.id).join("\n"))
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
              Are you sure you want to delete &ldquo;{productToDelete?.title || "this product"}&rdquo;?
              This action cannot be undone.
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
              Are you sure you want to delete {selectedProductIdsForDelete.length} selected products?
              This action cannot be undone.
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
