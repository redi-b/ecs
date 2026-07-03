"use client";

import type { MerchantProduct } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { DataTable } from "@/components/app/data-table";
import { Badge } from "@/components/ui/badge";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type ProductsTableProps = {
  products: MerchantProduct[];
  tenantId?: string | undefined;
};

function getProductColumns(tenantId?: string): ColumnDef<MerchantProduct>[] {
  return [
    {
      accessorKey: "title",
      header: "Product",
      cell: ({ row }) => {
        const product = row.original;
        const href = getTenantScopedPath(dashboardRoutes.productDetail(product.id), tenantId);

        return (
          <div className="flex min-w-56 flex-col gap-1">
            <Link className="font-medium text-foreground hover:underline" href={href}>
              {product.title ?? "Untitled product"}
            </Link>
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
      id: "price",
      header: "Price",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatFirstPrice(row.original)}</span>
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
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatMediaSignal(row.original)}</span>
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

function formatFirstPrice(product: MerchantProduct) {
  const price = product.variants?.flatMap((variant) => variant.prices)[0];

  if (price?.amount == null || !price.currencyCode) {
    return "No price";
  }

  return `${price.currencyCode.toUpperCase()} ${price.amount}`;
}

function formatMediaSignal(product: MerchantProduct) {
  const imageCount = product.images?.length ?? 0;

  if (product.thumbnail) {
    return imageCount > 0
      ? `Thumbnail + ${imageCount} image${imageCount === 1 ? "" : "s"}`
      : "Thumbnail";
  }

  if (imageCount > 0) {
    return `${imageCount} image${imageCount === 1 ? "" : "s"}`;
  }

  return "No media";
}
