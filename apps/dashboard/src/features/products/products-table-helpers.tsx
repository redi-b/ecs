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
  type ProductMediaFilter,
  type ProductStatusFilter,
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

export const productStatusFilterOptions: Array<{
  label: string;
  value: ProductStatusFilter;
}> = [
  { label: "All statuses", value: "all" },
  { label: "Published", value: "published" },
  { label: "Draft", value: "draft" },
  { label: "Unknown", value: "unknown" },
];

export type ProductStatusValue = "draft" | "published";

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

export function setUrlFilter(url: URL, key: string, value: string, defaultValue: string) {
  if (value !== defaultValue) {
    url.searchParams.set(key, value);
  } else {
    url.searchParams.delete(key);
  }
}

export function getProductColumns(
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
          product.collectionId
            ? (collectionById.get(product.collectionId)?.title ?? product.collectionId)
            : "",
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
              { href, icon: AppIcons.eye, label: "View details", type: "link" },
              { href, icon: AppIcons.products, label: "Manage inventory", type: "link" },
              {
                icon: nextStatus === "published" ? AppIcons.check : AppIcons.eyeOff,
                label: nextStatus === "published" ? "Publish product" : "Move to draft",
                onSelect: () => onStatusChange([product.id], nextStatus),
                type: "button",
              },
              { id: "identity", type: "separator" },
              {
                icon: AppIcons.copy,
                label: "Copy product ID",
                onSelect: () => copyToClipboard(product.id, "Product ID"),
                type: "button",
              },
              {
                disabled: !product.handle,
                icon: AppIcons.copy,
                label: "Copy handle",
                onSelect: () => copyToClipboard(product.handle ?? "", "Handle"),
                type: "button",
              },
              {
                disabled: !product.handle,
                icon: AppIcons.externalLink,
                label: "Copy storefront path",
                onSelect: () =>
                  copyToClipboard(
                    product.handle ? `/products/${product.handle}` : "",
                    "Product path",
                  ),
                type: "button",
              },
              { id: "danger", type: "separator" },
              {
                icon: AppIcons.trash,
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

export function ProductStockSummary({ product }: { product: MerchantProduct }) {
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

export function ProductOrganizationSummary({
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
            ? (collection?.title ?? collection?.handle ?? product.collectionId)
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

export function OrganizationSignal({
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

export function getProductStockSortValue(product: MerchantProduct) {
  const stocks = (product.variants ?? []).map((variant) => variant.stock).filter(isProductStock);

  if (!stocks.length) {
    return -1;
  }

  return stocks.reduce(
    (total, stock) => total + (stock.availableQuantity ?? stock.stockedQuantity ?? 0),
    0,
  );
}

export function isProductStock(
  stock: NonNullable<MerchantProduct["variants"]>[number]["stock"] | null | undefined,
): stock is NonNullable<NonNullable<MerchantProduct["variants"]>[number]["stock"]> {
  return Boolean(stock);
}

export function getDeletionErrorMessage(error: unknown, resourceName: string) {
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

export function getStatusLoadingMessage(count: number, status: ProductStatusValue) {
  const productLabel = count === 1 ? "product" : "products";

  return status === "published"
    ? `Publishing ${count} ${productLabel}...`
    : `Moving ${count} ${productLabel} to draft...`;
}

export function getStatusSuccessMessage(count: number, status: ProductStatusValue) {
  const productLabel = count === 1 ? "product" : "products";

  return status === "published"
    ? `${count} ${productLabel} published.`
    : `${count} ${productLabel} moved to draft.`;
}
