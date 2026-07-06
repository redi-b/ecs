"use client";

import type { MerchantOrder } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";

import { DataTable } from "@/components/app/data-table";
import {
  type DataTableFilterDefinition,
  DataTableFilters,
} from "@/components/app/data-table-filters";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  OrderCustomerCell,
  OrderIdentityCell,
  OrderMoneyCell,
  OrderStatusBadge,
} from "@/features/orders/order-table-cells";
import {
  filterOrdersForTable,
  formatOrderDate,
  getOrderTableCounts,
  getOrderTotalSortValue,
  type OrderLifecycleFilter,
} from "@/features/orders/order-table-state";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type OrdersTableProps = {
  initialLifecycle?: OrderLifecycleFilter | undefined;
  initialQuery?: string | undefined;
  orders: MerchantOrder[];
  pageSize: number;
  tenantId?: string | undefined;
  totalCount: number;
};

const orderLifecycleFilterOptions: Array<{
  label: string;
  value: OrderLifecycleFilter;
}> = [
  { label: "All orders", value: "all" },
  { label: "Open", value: "open" },
  { label: "Completed", value: "completed" },
  { label: "Canceled", value: "canceled" },
  { label: "Needs fulfillment", value: "needs_fulfillment" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Payment pending", value: "payment_pending" },
  { label: "Paid", value: "paid" },
];

function copyToClipboard(value: string) {
  if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(value).catch(() => undefined);
}

function getOrderColumns(tenantId?: string): ColumnDef<MerchantOrder>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all visible orders"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.displayId ?? row.original.id}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "order",
      accessorFn: (order) => order.displayId ?? order.id,
      header: ({ column }) => <DataTableHeader column={column} title="Order" />,
      cell: ({ row }) => {
        const href = getTenantScopedPath(dashboardRoutes.orderDetail(row.original.id), tenantId);

        return <OrderIdentityCell href={href} order={row.original} />;
      },
    },
    {
      id: "customer",
      accessorFn: (order) => order.email ?? order.delivery?.customerName ?? "",
      header: ({ column }) => <DataTableHeader column={column} title="Customer" />,
      cell: ({ row }) => <OrderCustomerCell order={row.original} />,
    },
    {
      id: "total",
      accessorFn: (order) => getOrderTotalSortValue(order),
      header: ({ column }) => <DataTableHeader column={column} title="Total" />,
      cell: ({ row }) => <OrderMoneyCell order={row.original} />,
    },
    {
      accessorKey: "paymentStatus",
      header: ({ column }) => <DataTableHeader column={column} title="Payment" />,
      cell: ({ row }) => <OrderStatusBadge status={row.original.paymentStatus} tone="payment" />,
    },
    {
      accessorKey: "fulfillmentStatus",
      header: ({ column }) => <DataTableHeader column={column} title="Fulfillment" />,
      cell: ({ row }) => (
        <OrderStatusBadge status={row.original.fulfillmentStatus} tone="fulfillment" />
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableHeader column={column} title="Status" />,
      cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableHeader column={column} title="Created" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatOrderDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const order = row.original;
        const href = getTenantScopedPath(dashboardRoutes.orderDetail(order.id), tenantId);

        return (
          <RowActionsMenu
            actions={[
              { href, label: "View details", type: "link" },
              { id: "identity", type: "separator" },
              {
                label: "Copy order ID",
                onSelect: () => copyToClipboard(order.id),
                type: "button",
              },
              {
                disabled: !order.email,
                label: "Copy customer email",
                onSelect: () => copyToClipboard(order.email ?? ""),
                type: "button",
              },
            ]}
            label={`Open actions for ${order.displayId ?? order.id}`}
          />
        );
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];
}

export function OrdersTable({
  initialLifecycle = "all",
  initialQuery = "",
  orders,
  pageSize,
  tenantId,
  totalCount,
}: OrdersTableProps) {
  const [query, setQuery] = useState(initialQuery);
  const [lifecycle, setLifecycle] = useState<OrderLifecycleFilter>(initialLifecycle);
  const hasSyncedInitialUrlState = useRef(false);
  void pageSize;

  const filteredOrders = useMemo(
    () => filterOrdersForTable(orders, { lifecycle, query }),
    [orders, lifecycle, query],
  );
  const counts = getOrderTableCounts({
    filteredCount: filteredOrders.length,
    filters: { lifecycle, query },
    pageCount: orders.length,
    totalCount,
  });
  const filters: DataTableFilterDefinition[] = [
    {
      defaultValue: "all",
      id: "lifecycle",
      label: "Lifecycle",
      onChange: (value) => setLifecycle(value as OrderLifecycleFilter),
      options: orderLifecycleFilterOptions,
      value: lifecycle,
    },
  ];

  function clearFilters() {
    setQuery("");
    setLifecycle("all");
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

    if (lifecycle !== "all") {
      url.searchParams.set("lifecycle", lifecycle);
    } else {
      url.searchParams.delete("lifecycle");
    }

    url.searchParams.delete("page");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [lifecycle, query]);

  const toolbar = (
    <div className="flex flex-col gap-3">
      <DataTableFilters filters={filters} onClearAll={clearFilters}>
        <InputGroup className="h-10 rounded-full bg-background/70 px-1 sm:max-w-sm">
          <InputGroupAddon>
            <AppIcons.search data-icon="inline-start" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search orders"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search orders"
            value={query}
          />
          {query.trim() ? (
            <InputGroupAddon align="inline-end">
              <Button
                aria-label="Clear order search"
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

  return (
    <DataTable
      bulkActions={(selectedOrders) => (
        <Button
          onClick={() => copyToClipboard(selectedOrders.map((order) => order.id).join("\n"))}
          size="sm"
          type="button"
          variant="outline"
        >
          <AppIcons.copy data-icon="inline-start" />
          Copy IDs
        </Button>
      )}
      columns={getOrderColumns(tenantId)}
      data={filteredOrders}
      emptyMessage="No orders have been placed for this merchant yet."
      emptyTitle="No orders yet"
      filteredEmptyMessage="No orders match the current search or filters."
      filteredEmptyTitle="No matching orders"
      getRowId={(order) => order.id}
      isFiltered={counts.hasActiveFilter}
      selectedSummaryLabel={(count) => `order${count === 1 ? "" : "s"} selected`}
      toolbar={toolbar}
    />
  );
}
