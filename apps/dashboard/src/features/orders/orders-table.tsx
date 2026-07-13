"use client";

import type { MerchantOrder } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
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
  OrderDeliveryCell,
  OrderIdentityCell,
  OrderMoneyCell,
  OrderPaymentCell,
  OrderPlacedCell,
  OrderProgressBadge,
} from "@/features/orders/order-table-cells";
import {
  formatOrderReference,
  getOrderCustomerPhone,
  type OrderListFilterState,
} from "@/features/orders/order-domain";
import { copyTextToClipboard } from "@/lib/clipboard";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type OrdersTableProps = {
  filters: OrderListFilterState;
  footer?: ReactNode;
  orders: MerchantOrder[];
  pageSize: number;
  tenantId?: string | undefined;
  totalCount: number;
};

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
          aria-label={`Select order ${formatOrderReference(row.original)}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "order",
      accessorFn: (order) => formatOrderReference(order),
      header: ({ column }) => <DataTableHeader column={column} title="Order" />,
      cell: ({ row }) => (
        <OrderIdentityCell order={row.original} {...(tenantId ? { tenantId } : {})} />
      ),
    },
    {
      id: "customer",
      accessorFn: (order) => order.delivery?.customerName ?? order.email ?? "",
      header: ({ column }) => <DataTableHeader column={column} title="Customer" />,
      cell: ({ row }) => <OrderCustomerCell order={row.original} />,
    },
    {
      id: "total",
      accessorFn: (order) => order.total ?? 0,
      header: ({ column }) => <DataTableHeader column={column} title="Total" />,
      cell: ({ row }) => <OrderMoneyCell order={row.original} />,
    },
    {
      id: "payment",
      header: ({ column }) => <DataTableHeader column={column} title="Payment" />,
      cell: ({ row }) => <OrderPaymentCell order={row.original} />,
      enableSorting: false,
    },
    {
      id: "progress",
      header: ({ column }) => <DataTableHeader column={column} title="Progress" />,
      cell: ({ row }) => <OrderProgressBadge order={row.original} />,
      enableSorting: false,
    },
    {
      id: "delivery",
      header: ({ column }) => <DataTableHeader column={column} title="Delivery" />,
      cell: ({ row }) => <OrderDeliveryCell order={row.original} />,
      enableSorting: false,
    },
    {
      id: "placed",
      accessorFn: (order) => order.createdAt ?? "",
      header: ({ column }) => <DataTableHeader column={column} title="Placed" />,
      cell: ({ row }) => <OrderPlacedCell order={row.original} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const order = row.original;
        const phone = getOrderCustomerPhone(order);
        const detailHref = getTenantScopedPath(dashboardRoutes.orderDetail(order.id), tenantId);

        return (
          <RowActionsMenu
            label={`Actions for order ${formatOrderReference(order)}`}
            actions={[
              {
                type: "link",
                label: "View details",
                href: detailHref,
                icon: AppIcons.eye,
              },
              {
                type: "button",
                label: "Copy order code",
                icon: AppIcons.copy,
                onSelect: () => void copyToClipboard(formatOrderReference(order), "Order code"),
              },
              ...(phone
                ? [
                    {
                      type: "button" as const,
                      label: "Copy phone",
                      icon: AppIcons.copy,
                      onSelect: () => void copyToClipboard(phone, "Phone"),
                    },
                  ]
                : []),
            ]}
          />
        );
      },
      enableSorting: false,
    },
  ];
}

export function OrdersTable({
  filters,
  footer,
  orders,
  pageSize: _pageSize,
  tenantId,
  totalCount,
}: OrdersTableProps) {
  // Server pagination owns paging — do not pass pageSize into DataTable
  // (that enables a second client pagination footer).
  void _pageSize;

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(filters.q);
  const columns = useMemo(() => getOrderColumns(tenantId), [tenantId]);

  const pushFilters = useCallback(
    (next: Partial<OrderListFilterState>) => {
      const merged: OrderListFilterState = { ...filters, ...next };
      const url = new URL(window.location.href);

      const apply = (key: string, value: string, skip = "all") => {
        if (!value || value === skip) url.searchParams.delete(key);
        else url.searchParams.set(key, value);
      };

      apply("q", merged.q, "");
      apply("progress", merged.progress);
      apply("payment", merged.payment);
      apply("method", merged.method);
      apply("delivery", merged.delivery);
      apply("created", merged.created);
      url.searchParams.delete("page");

      startTransition(() => {
        router.push(`${url.pathname}?${url.searchParams.toString()}`);
      });
    },
    [filters, router],
  );

  const clearFilters = useCallback(() => {
    setSearchValue("");
    pushFilters({
      q: "",
      progress: "all",
      payment: "all",
      method: "all",
      delivery: "all",
      created: "all",
    });
  }, [pushFilters]);

  const filterDefs = useMemo<DataTableFilterDefinition[]>(
    () => [
      {
        id: "progress",
        label: "Progress",
        defaultValue: "all",
        value: filters.progress,
        options: [
          { label: "All", value: "all" },
          { label: "Open", value: "open" },
          { label: "New", value: "new" },
          { label: "Ready", value: "ready" },
          { label: "Completed", value: "completed" },
          { label: "Canceled", value: "canceled" },
        ],
        onChange: (value) =>
          pushFilters({ progress: value as OrderListFilterState["progress"] }),
      },
      {
        id: "payment",
        label: "Payment",
        defaultValue: "all",
        value: filters.payment,
        options: [
          { label: "All", value: "all" },
          { label: "Unpaid", value: "unpaid" },
          { label: "Paid", value: "paid" },
          { label: "Failed", value: "failed" },
        ],
        onChange: (value) =>
          pushFilters({ payment: value as OrderListFilterState["payment"] }),
      },
      {
        id: "method",
        label: "Method",
        defaultValue: "all",
        value: filters.method,
        options: [
          { label: "All", value: "all" },
          { label: "Cash", value: "cod" },
          { label: "Online", value: "chapa" },
        ],
        onChange: (value) => pushFilters({ method: value as OrderListFilterState["method"] }),
      },
      {
        id: "delivery",
        label: "Delivery",
        defaultValue: "all",
        value: filters.delivery,
        options: [
          { label: "All", value: "all" },
          { label: "Local delivery", value: "delivery" },
          { label: "Pickup", value: "pickup" },
        ],
        onChange: (value) =>
          pushFilters({ delivery: value as OrderListFilterState["delivery"] }),
      },
      {
        id: "created",
        label: "Placed",
        defaultValue: "all",
        value: filters.created,
        options: [
          { label: "All time", value: "all" },
          { label: "Today", value: "today" },
          { label: "Last 7 days", value: "last_7_days" },
          { label: "Last 30 days", value: "last_30_days" },
        ],
        onChange: (value) =>
          pushFilters({ created: value as OrderListFilterState["created"] }),
      },
    ],
    [filters, pushFilters],
  );

  const hasActiveFilters =
    Boolean(filters.q) ||
    filters.progress !== "all" ||
    filters.payment !== "all" ||
    filters.method !== "all" ||
    filters.delivery !== "all" ||
    filters.created !== "all";

  const toolbar = (
    <div className="flex flex-col gap-3">
      <DataTableFilters filters={filterDefs} onClearAll={clearFilters}>
        <ListToolbarSearch
          clearLabel="Clear order search"
          label="Search orders"
          onChange={(value) => {
            setSearchValue(value);
            pushFilters({ q: value });
          }}
          placeholder="Search name, phone, order code…"
          value={searchValue}
        />
      </DataTableFilters>

      <p className="text-sm text-muted-foreground">
        {pending
          ? "Updating…"
          : hasActiveFilters
            ? `${orders.length} of ${totalCount} matching`
            : `${orders.length} on this page, ${totalCount} total`}
      </p>
    </div>
  );

  return (
    <DataTable
      bulkActions={(selectedOrders) => (
        <div className="flex items-center gap-2">
          <Button
            onClick={() =>
              void copyToClipboard(
                selectedOrders.map((order) => formatOrderReference(order)).join("\n"),
                "Order codes",
              )
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <AppIcons.copy data-icon="inline-start" />
            Copy codes
          </Button>
          <Button
            onClick={() => {
              const phones = selectedOrders
                .map((order) => getOrderCustomerPhone(order))
                .filter((phone): phone is string => Boolean(phone));
              if (!phones.length) {
                toast.error("No phone numbers on the selected orders.");
                return;
              }
              void copyToClipboard(phones.join("\n"), "Phone numbers");
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <AppIcons.copy data-icon="inline-start" />
            Copy phones
          </Button>
        </div>
      )}
      columns={columns}
      data={orders}
      emptyMessage={
        hasActiveFilters
          ? "No orders match these filters."
          : "No orders yet. Create one or wait for storefront sales."
      }
      emptyTitle={hasActiveFilters ? "No matching orders" : "No orders yet"}
      filteredEmptyMessage="Try clearing filters or searching for another order code, name, or phone."
      filteredEmptyTitle="No matching orders"
      footer={footer}
      getRowId={(row) => row.id}
      isFiltered={hasActiveFilters}
      selectedSummaryLabel={(count) => `order${count === 1 ? "" : "s"} selected`}
      toolbar={toolbar}
    />
  );
}
