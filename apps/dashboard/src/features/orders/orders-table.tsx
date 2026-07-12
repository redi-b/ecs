"use client";

import type { MerchantOrder } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/app/data-table";
import {
  type DataTableFilterDefinition,
  DataTableFilters,
} from "@/components/app/data-table-filters";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  type OrderDateFilter,
  type OrderDeliveryFilter,
  type OrderFulfillmentFilter,
  type OrderLifecycleFilter,
  type OrderPaymentFilter,
} from "@/features/orders/order-table-state";
import { copyTextToClipboard } from "@/lib/clipboard";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type OrdersTableProps = {
  footer?: ReactNode;
  initialCreated?: OrderDateFilter | undefined;
  initialDelivery?: OrderDeliveryFilter | undefined;
  initialFulfillment?: OrderFulfillmentFilter | undefined;
  initialLifecycle?: OrderLifecycleFilter | undefined;
  initialPayment?: OrderPaymentFilter | undefined;
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
              { href, icon: AppIcons.eye, label: "View details", type: "link" },
              { id: "identity", type: "separator" },
              {
                icon: AppIcons.copy,
                label: "Copy order ID",
                onSelect: () => copyToClipboard(order.id, "Order ID"),
                type: "button",
              },
              {
                disabled: !order.email,
                icon: AppIcons.copy,
                label: "Copy customer email",
                onSelect: () => copyToClipboard(order.email ?? "", "Customer email"),
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
  footer,
  initialCreated = "all",
  initialDelivery = "all",
  initialFulfillment = "all",
  initialLifecycle = "all",
  initialPayment = "all",
  initialQuery = "",
  orders,
  pageSize,
  tenantId,
  totalCount,
}: OrdersTableProps) {
  const [query, setQuery] = useState(initialQuery);
  const [lifecycle, setLifecycle] = useState<OrderLifecycleFilter>(initialLifecycle);
  const [payment, setPayment] = useState<OrderPaymentFilter>(initialPayment);
  const [fulfillment, setFulfillment] = useState<OrderFulfillmentFilter>(initialFulfillment);
  const [delivery, setDelivery] = useState<OrderDeliveryFilter>(initialDelivery);
  const [created, setCreated] = useState<OrderDateFilter>(initialCreated);
  const hasSyncedInitialUrlState = useRef(false);
  void pageSize;

  const filteredOrders = useMemo(
    () =>
      filterOrdersForTable(orders, {
        created,
        delivery,
        fulfillment,
        lifecycle,
        payment,
        query,
      }),
    [orders, created, delivery, fulfillment, lifecycle, payment, query],
  );
  const counts = getOrderTableCounts({
    filteredCount: filteredOrders.length,
    filters: { created, delivery, fulfillment, lifecycle, payment, query },
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
    {
      defaultValue: "all",
      id: "payment",
      label: "Payment",
      onChange: (value) => setPayment(value as OrderPaymentFilter),
      options: [
        { label: "All payments", value: "all" },
        { label: "Paid", value: "paid" },
        { label: "Pending", value: "pending" },
        { label: "Unpaid", value: "unpaid" },
        { label: "Unknown", value: "unknown" },
      ],
      value: payment,
    },
    {
      defaultValue: "all",
      id: "fulfillment",
      label: "Fulfillment",
      onChange: (value) => setFulfillment(value as OrderFulfillmentFilter),
      options: [
        { label: "All fulfillment", value: "all" },
        { label: "Needs fulfillment", value: "needs_fulfillment" },
        { label: "Fulfilled", value: "fulfilled" },
        { label: "Unfulfilled", value: "unfulfilled" },
        { label: "Unknown", value: "unknown" },
      ],
      value: fulfillment,
    },
    {
      defaultValue: "all",
      id: "delivery",
      label: "Delivery",
      onChange: (value) => setDelivery(value as OrderDeliveryFilter),
      options: [
        { label: "All delivery", value: "all" },
        { label: "Delivery", value: "delivery" },
        { label: "Pickup", value: "pickup" },
        { label: "No delivery choice", value: "none" },
      ],
      value: delivery,
    },
    {
      defaultValue: "all",
      id: "created",
      label: "Created",
      onChange: (value) => setCreated(value as OrderDateFilter),
      options: [
        { label: "All dates", value: "all" },
        { label: "Today", value: "today" },
        { label: "Last 7 days", value: "last_7_days" },
        { label: "Last 30 days", value: "last_30_days" },
        { label: "No date", value: "no_date" },
      ],
      value: created,
    },
  ];

  function clearFilters() {
    setQuery("");
    setLifecycle("all");
    setPayment("all");
    setFulfillment("all");
    setDelivery("all");
    setCreated("all");
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

    setUrlFilter(url, "payment", payment, "all");
    setUrlFilter(url, "fulfillment", fulfillment, "all");
    setUrlFilter(url, "delivery", delivery, "all");
    setUrlFilter(url, "created", created, "all");

    url.searchParams.delete("page");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [created, delivery, fulfillment, lifecycle, payment, query]);

  const toolbar = (
    <div className="flex flex-col gap-3">
      <DataTableFilters filters={filters} onClearAll={clearFilters}>
        <ListToolbarSearch
          clearLabel="Clear order search"
          label="Search orders"
          onChange={setQuery}
          placeholder="Search orders"
          value={query}
        />
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
          onClick={() =>
            copyToClipboard(selectedOrders.map((order) => order.id).join("\n"), "Order IDs")
          }
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
      footer={footer}
    />
  );
}
