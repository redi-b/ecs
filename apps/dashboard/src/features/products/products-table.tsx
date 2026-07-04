"use client";

import type { MerchantProduct } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  pageSize: number;
  products: MerchantProduct[];
  tenantId?: string | undefined;
  totalCount: number;
};

function getProductColumns(tenantId?: string): ColumnDef<MerchantProduct>[] {
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
      cell: ({ row }) => <ProductIdentityCell product={row.original} tenantId={tenantId} />,
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
              { href, label: "Edit product", type: "link" },
              { type: "separator" },
              {
                label: "Copy product ID",
                onSelect: () => void navigator.clipboard?.writeText(product.id),
                type: "button",
              },
              {
                disabled: !product.handle,
                label: "Copy handle",
                onSelect: () => void navigator.clipboard?.writeText(product.handle ?? ""),
                type: "button",
              },
            ]}
            label={`Open actions for ${product.title ?? product.id}`}
          />
        );
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];
}

export function ProductsTable({ pageSize, products, tenantId, totalCount }: ProductsTableProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProductStatusFilter>("all");
  void pageSize;
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

  const toolbar = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
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
        </InputGroup>
        <Select onValueChange={(value) => setStatus(value as ProductStatusFilter)} value={status}>
          <SelectTrigger aria-label="Filter products by status" className="h-10 rounded-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">
        {counts.hasActiveFilter
          ? `${counts.filteredCount} of ${counts.pageCount} on this page`
          : `${counts.pageCount} on this page, ${counts.totalCount} total`}
      </p>
    </div>
  );

  return (
    <DataTable
      bulkActions={(selectedProducts) => (
        <Button
          onClick={() =>
            void navigator.clipboard?.writeText(
              selectedProducts.map((product) => product.id).join("\n"),
            )
          }
          size="sm"
          type="button"
          variant="outline"
        >
          <AppIcons.copy data-icon="inline-start" />
          Copy IDs
        </Button>
      )}
      columns={getProductColumns(tenantId)}
      data={filteredProducts}
      emptyMessage="No products have been synced for this merchant yet."
      filteredEmptyMessage="No products match the current search or filters."
      getRowId={(product) => product.id}
      selectedSummaryLabel="products selected"
      toolbar={toolbar}
    />
  );
}
