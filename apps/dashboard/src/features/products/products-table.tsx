"use client";

import type { MerchantProduct } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/app/data-table";
import {
  formatProductDate,
  formatProductFirstPrice,
  ProductIdentityCell,
  ProductMediaSignal,
  ProductStatusBadge,
} from "@/features/products/product-table-cells";

type ProductsTableProps = {
  products: MerchantProduct[];
  tenantId?: string | undefined;
};

function getProductColumns(tenantId?: string): ColumnDef<MerchantProduct>[] {
  return [
    {
      accessorKey: "title",
      header: "Product",
      cell: ({ row }) => <ProductIdentityCell product={row.original} tenantId={tenantId} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <ProductStatusBadge status={row.original.status} />,
    },
    {
      id: "price",
      header: "Price",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatProductFirstPrice(row.original)}</span>
      ),
    },
    {
      id: "variants",
      header: "Variants",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.variants?.length ?? 0}</span>
      ),
    },
    {
      id: "media",
      header: "Media",
      cell: ({ row }) => <ProductMediaSignal product={row.original} />,
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatProductDate(row.original.updatedAt)}</span>
      ),
    },
  ];
}

export function ProductsTable({ products, tenantId }: ProductsTableProps) {
  return (
    <DataTable
      columns={getProductColumns(tenantId)}
      data={products}
      emptyMessage="No products have been synced for this merchant yet."
    />
  );
}
