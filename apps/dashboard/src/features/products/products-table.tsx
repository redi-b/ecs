"use client";

import type { MerchantProduct } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/app/data-table";
import { Badge } from "@/components/ui/badge";

type ProductsTableProps = {
  products: MerchantProduct[];
};

const productColumns: ColumnDef<MerchantProduct>[] = [
  {
    accessorKey: "title",
    header: "Product",
    cell: ({ row }) => {
      const product = row.original;

      return (
        <div className="flex min-w-56 flex-col gap-1">
          <span className="font-medium text-foreground">{product.title ?? "Untitled product"}</span>
          <span className="text-xs text-muted-foreground">
            {product.handle ? `/${product.handle}` : product.id}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <ProductStatusBadge status={row.original.status} />,
  },
  {
    id: "variants",
    header: "Variants",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.variants?.length ?? 0}</span>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatDate(row.original.updatedAt)}</span>
    ),
  },
];

export function ProductsTable({ products }: ProductsTableProps) {
  return (
    <DataTable
      columns={productColumns}
      data={products}
      emptyMessage="No products have been synced for this merchant yet."
    />
  );
}

function ProductStatusBadge({ status }: { status: string | null }) {
  const normalized = status?.toLowerCase() ?? "unknown";
  const variant =
    normalized === "published" ? "default" : normalized === "draft" ? "secondary" : "outline";

  return (
    <Badge className="capitalize" variant={variant}>
      {normalized.replaceAll("_", " ")}
    </Badge>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}
