"use client";

import type { MerchantOrder } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/app/data-table";
import { Badge } from "@/components/ui/badge";

type OrdersTableProps = {
  orders: MerchantOrder[];
};

const orderColumns: ColumnDef<MerchantOrder>[] = [
  {
    accessorKey: "displayId",
    header: "Order",
    cell: ({ row }) => (
      <div className="flex min-w-32 flex-col gap-1">
        <span className="font-medium text-foreground">
          {row.original.displayId ? `#${row.original.displayId}` : row.original.id}
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Customer",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.email ?? "No email captured"}</span>
    ),
  },
  {
    accessorKey: "total",
    header: "Total",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatMoney(row.original.total, row.original.currencyCode)}
      </span>
    ),
  },
  {
    accessorKey: "paymentStatus",
    header: "Payment",
    cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} />,
  },
  {
    accessorKey: "fulfillmentStatus",
    header: "Fulfillment",
    cell: ({ row }) => <StatusBadge status={row.original.fulfillmentStatus} />,
  },
];

export function OrdersTable({ orders }: OrdersTableProps) {
  return (
    <DataTable
      columns={orderColumns}
      data={orders}
      emptyMessage="No orders have been placed for this merchant yet."
    />
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const normalized = status?.toLowerCase() ?? "unknown";
  const variant =
    normalized.includes("paid") || normalized.includes("fulfilled") ? "default" : "outline";

  return (
    <Badge className="capitalize" variant={variant}>
      {normalized.replaceAll("_", " ")}
    </Badge>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatMoney(total: number | null, currencyCode: string | null) {
  if (typeof total !== "number") {
    return "Not available";
  }

  return new Intl.NumberFormat("en", {
    currency: currencyCode?.toUpperCase() || "USD",
    style: "currency",
  }).format(total / 100);
}
