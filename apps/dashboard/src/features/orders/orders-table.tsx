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
import { ListResultsStatus } from "@/components/app/list-results-status";
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
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
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

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

async function copyToClipboard(value: string, label: string, t: Translate) {
  try {
    const copied = await copyTextToClipboard(value);
    if (!copied) {
      toast.error(t("table.actions.copyEmpty"));
      return;
    }
    toast.success(t("table.actions.copySuccess", { label }));
  } catch {
    toast.error(t("table.actions.copyFailed"));
  }
}

function getOrderColumns(t: Translate, tenantId?: string): ColumnDef<MerchantOrder>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label={t("table.actions.selectAllVisible", {
            entity: t("taxonomy.entity.order.plural").toLowerCase(),
          })}
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={t("orders.table.selectOrderAria", {
            name: formatOrderReference(row.original),
          })}
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
      header: ({ column }) => <DataTableHeader column={column} title={t("table.headers.order")} />,
      cell: ({ row }) => (
        <OrderIdentityCell order={row.original} {...(tenantId ? { tenantId } : {})} />
      ),
    },
    {
      id: "customer",
      accessorFn: (order) => order.delivery?.customerName ?? order.email ?? "",
      header: ({ column }) => (
        <DataTableHeader column={column} title={t("table.headers.customer")} />
      ),
      cell: ({ row }) => <OrderCustomerCell order={row.original} />,
    },
    {
      id: "total",
      accessorFn: (order) => order.total ?? 0,
      header: ({ column }) => <DataTableHeader column={column} title={t("table.headers.total")} />,
      cell: ({ row }) => <OrderMoneyCell order={row.original} />,
    },
    {
      id: "payment",
      header: ({ column }) => (
        <DataTableHeader column={column} title={t("table.headers.payment")} />
      ),
      cell: ({ row }) => <OrderPaymentCell order={row.original} />,
      enableSorting: false,
    },
    {
      id: "progress",
      header: ({ column }) => (
        <DataTableHeader column={column} title={t("table.headers.progress")} />
      ),
      cell: ({ row }) => <OrderProgressBadge order={row.original} />,
      enableSorting: false,
    },
    {
      id: "delivery",
      header: ({ column }) => (
        <DataTableHeader column={column} title={t("table.headers.delivery")} />
      ),
      cell: ({ row }) => <OrderDeliveryCell order={row.original} />,
      enableSorting: false,
    },
    {
      id: "placed",
      accessorFn: (order) => order.createdAt ?? "",
      header: ({ column }) => <DataTableHeader column={column} title={t("table.headers.placed")} />,
      cell: ({ row }) => <OrderPlacedCell order={row.original} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("table.headers.actions")}</span>,
      cell: ({ row }) => {
        const order = row.original;
        const phone = getOrderCustomerPhone(order);
        const detailHref = getTenantScopedPath(dashboardRoutes.orderDetail(order.id), tenantId);
        const ref = formatOrderReference(order);

        return (
          <RowActionsMenu
            label={t("orders.table.actionsFor", { name: ref })}
            actions={[
              {
                type: "link",
                label: t("table.actions.viewDetails"),
                href: detailHref,
                icon: AppIcons.eye,
              },
              {
                type: "button",
                label: t("table.actions.copyId", { entity: t("taxonomy.entity.order.label") }),
                icon: AppIcons.copy,
                onSelect: () => void copyToClipboard(ref, t("orders.table.orderCode"), t),
              },
              ...(phone
                ? [
                    {
                      type: "button" as const,
                      label: t("table.actions.copyPhone"),
                      icon: AppIcons.copy,
                      onSelect: () => void copyToClipboard(phone, t("orders.table.phone"), t),
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

  // (that enables a second client pagination footer).
  void _pageSize;

  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(filters.q);
  const columns = useMemo(() => getOrderColumns(t, tenantId), [t, tenantId]);

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
        label: t("orders.filter.progress.label"),
        defaultValue: "all",
        value: filters.progress,
        options: [
          { label: t("orders.filter.progress.all"), value: "all" },
          { label: t("orders.filter.progress.open"), value: "open" },
          { label: t("orders.filter.progress.new"), value: "new" },
          { label: t("orders.filter.progress.ready"), value: "ready" },
          { label: t("orders.filter.progress.completed"), value: "completed" },
          { label: t("orders.filter.progress.canceled"), value: "canceled" },
        ],
        onChange: (value) =>
          pushFilters({ progress: value as OrderListFilterState["progress"] }),
      },
      {
        id: "payment",
        label: t("orders.filter.payment.label"),
        defaultValue: "all",
        value: filters.payment,
        options: [
          { label: t("orders.filter.payment.all"), value: "all" },
          { label: t("orders.filter.payment.unpaid"), value: "unpaid" },
          { label: t("orders.filter.payment.paid"), value: "paid" },
          { label: t("orders.filter.payment.failed"), value: "failed" },
        ],
        onChange: (value) =>
          pushFilters({ payment: value as OrderListFilterState["payment"] }),
      },
      {
        id: "method",
        label: t("orders.filter.method.label"),
        defaultValue: "all",
        value: filters.method,
        options: [
          { label: t("orders.filter.method.all"), value: "all" },
          { label: t("orders.filter.method.cod"), value: "cod" },
          { label: t("orders.filter.method.chapa"), value: "chapa" },
        ],
        onChange: (value) => pushFilters({ method: value as OrderListFilterState["method"] }),
      },
      {
        id: "delivery",
        label: t("orders.filter.delivery.label"),
        defaultValue: "all",
        value: filters.delivery,
        options: [
          { label: t("orders.filter.delivery.all"), value: "all" },
          { label: t("orders.filter.delivery.delivery"), value: "delivery" },
          { label: t("orders.filter.delivery.pickup"), value: "pickup" },
        ],
        onChange: (value) =>
          pushFilters({ delivery: value as OrderListFilterState["delivery"] }),
      },
      {
        id: "created",
        label: t("orders.filter.created.label"),
        defaultValue: "all",
        value: filters.created,
        options: [
          { label: t("orders.filter.created.all"), value: "all" },
          { label: t("orders.filter.created.today"), value: "today" },
          { label: t("orders.filter.created.last_7_days"), value: "last_7_days" },
          { label: t("orders.filter.created.last_30_days"), value: "last_30_days" },
        ],
        onChange: (value) =>
          pushFilters({ created: value as OrderListFilterState["created"] }),
      },
    ],
    [filters, pushFilters, t],
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
          clearLabel={t("common.clearSearch")}
          label={t("orders.table.searchLabel")}
          onChange={(value) => {
            setSearchValue(value);
            pushFilters({ q: value });
          }}
          placeholder={t("orders.table.searchPlaceholder")}
          value={searchValue}
        />
      </DataTableFilters>

      <ListResultsStatus
        hasServerFilter={hasActiveFilters}
        pageCount={orders.length}
        pending={pending}
        totalCount={totalCount}
      />
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
                t("orders.table.orderCodes"),
                t,
              )
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <AppIcons.copy data-icon="inline-start" />
            {t("orders.table.copyCodes")}
          </Button>
          <Button
            onClick={() => {
              const phones = selectedOrders
                .map((order) => getOrderCustomerPhone(order))
                .filter((phone): phone is string => Boolean(phone));
              if (!phones.length) {
                toast.error(t("orders.table.noPhonesSelected"));
                return;
              }
              void copyToClipboard(phones.join("\n"), t("orders.table.phoneNumbers"), t);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <AppIcons.copy data-icon="inline-start" />
            {t("orders.table.copyPhones")}
          </Button>
        </div>
      )}
      columns={columns}
      data={orders}
      emptyIcon={<AppIcons.orders className="size-5" aria-hidden />}
      emptyMessage={
        hasActiveFilters ? t("orders.table.filteredEmptyMessage") : t("orders.table.emptyMessage")
      }
      emptyTitle={
        hasActiveFilters ? t("orders.table.filteredEmptyTitle") : t("orders.table.emptyTitle")
      }
      filteredEmptyMessage={t("orders.table.filteredEmptyMessage")}
      filteredEmptyTitle={t("orders.table.filteredEmptyTitle")}
      footer={footer}
      getRowId={(row) => row.id}
      isFiltered={hasActiveFilters}
      isLoading={pending}
      selectedSummaryLabel={t("orders.table.selectedSummary")}
      toolbar={toolbar}
    />
  );
}
