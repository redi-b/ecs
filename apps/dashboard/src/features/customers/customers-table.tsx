"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "@/components/app/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/app/data-table";
import { DataTableFilters } from "@/components/app/data-table-filters";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
import { ListResultsStatus } from "@/components/app/list-results-status";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { MerchantCustomer } from "@/lib/merchant-customers";
import { listEntityActionClassName } from "@/lib/list-entity-link";
import { dashboardRoutes } from "@/lib/routes";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

function customerDisplayName(customer: MerchantCustomer) {
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email
  );
}

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

export function CustomersTable({
  customers,
  footer,
  highlightCustomerId,
  initialQuery = "",
  totalCount,
}: {
  customers: MerchantCustomer[];
  footer?: ReactNode;
  /** When set (e.g. from order detail), flash that row and open edit if present. */
  highlightCustomerId?: string | undefined;
  initialQuery?: string | undefined;
  totalCount: number;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(initialQuery);
  const [editing, setEditing] = useState<MerchantCustomer | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    setSearchValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!highlightCustomerId) return;
    setHighlightedId(highlightCustomerId);
    const timeout = window.setTimeout(() => setHighlightedId(null), 3500);
    // Drop highlight query from the URL without a navigation stack entry.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("highlight")) {
        url.searchParams.delete("highlight");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      }
    }
    return () => window.clearTimeout(timeout);
  }, [customers, highlightCustomerId]);

  const pushQuery = useCallback(
    (q: string) => {
      const url = new URL(window.location.href);
      if (q.trim()) url.searchParams.set("q", q.trim());
      else url.searchParams.delete("q");
      url.searchParams.delete("page");
      startTransition(() => {
        router.push(`${url.pathname}?${url.searchParams.toString()}`);
      });
    },
    [router],
  );

  const hasActiveFilter = Boolean(initialQuery.trim());

  const columns = useMemo<ColumnDef<MerchantCustomer>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label={t("table.actions.selectAllVisible", { entity: t("taxonomy.entity.customer.plural").toLowerCase() })}
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={t("table.actions.selectRow", { name: customerDisplayName(row.original) })}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          />
        ),
        enableHiding: false,
        enableSorting: false,
      },
      {
        id: "name",
        accessorFn: (customer) => customerDisplayName(customer),
        header: ({ column }) => <DataTableHeader column={column} title={t("table.headers.customer")} />,
        cell: ({ row }) => {
          const isHighlighted = highlightedId === row.original.id;
          return (
            <div
              className={cn(
                "min-w-0 rounded-md px-1.5 py-1 transition-colors",
                isHighlighted && "bg-primary/10 ring-2 ring-primary/40",
              )}
              data-highlighted={isHighlighted ? "true" : undefined}
              id={isHighlighted ? `customer-row-${row.original.id}` : undefined}
            >
              <button
                className={cn(listEntityActionClassName, "truncate")}
                onClick={() => setEditing(row.original)}
                type="button"
              >
                {customerDisplayName(row.original)}
              </button>
              <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "phone",
        header: ({ column }) => <DataTableHeader column={column} title={t("customers.detail.phone")} />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.phone || "—"}</span>
        ),
      },
      {
        id: "groups",
        header: ({ column }) => <DataTableHeader column={column} title={t("customers.detail.groups")} />,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.groups.length ? (
              row.original.groups.map((group) => (
                <Badge key={group.id} variant="secondary">
                  {group.name.startsWith("Tenant ") || group.name.startsWith("Shop ")
                    ? t("customers.table.groupCustomer")
                    : group.name}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        ),
        enableSorting: false,
      },
      {
        id: "addresses",
        accessorFn: (customer) => customer.addresses.length,
        header: ({ column }) => <DataTableHeader column={column} title={t("customers.detail.addresses")} />,
        cell: ({ row }) => {
          const count = row.original.addresses.length;
          if (!count) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          const hasDefault = row.original.addresses.some(
            (address) => address.isDefaultBilling || address.isDefaultShipping,
          );
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm tabular-nums text-muted-foreground">
                {count === 1 ? t("customers.table.addressCountOne") : t("customers.table.addressesCount", { count })}
              </span>
              {hasDefault ? (
                <Badge className="font-normal" variant="outline">
                  {t("customers.table.defaultSet")}
                </Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableHeader column={column} title={t("table.headers.joined")} />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
              new Date(row.original.createdAt),
            )}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("table.headers.actions")}</span>,
        cell: ({ row }) => {
          const customer = row.original;
          return (
            <RowActionsMenu
              actions={[
                {
                  href: dashboardRoutes.customerDetail(customer.id),
                  icon: AppIcons.eye,
                  label: t("table.actions.viewDetails"),
                  type: "link",
                },
                {
                  icon: AppIcons.edit,
                  label: t("customers.detail.editCustomer"),
                  onSelect: () => setEditing(customer),
                  type: "button",
                },
                { id: "copy", type: "separator" },
                {
                  icon: AppIcons.copy,
                  label: t("table.actions.copyEmail"),
                  onSelect: () => void copyToClipboard(customer.email, t("customers.detail.email"), t),
                  type: "button",
                },
                {
                  disabled: !customer.phone,
                  icon: AppIcons.copy,
                  label: t("table.actions.copyPhone"),
                  onSelect: () => void copyToClipboard(customer.phone ?? "", t("customers.detail.phone"), t),
                  type: "button",
                },
              ]}
              label={t("table.actions.openActionsFor", { name: customerDisplayName(customer) })}
            />
          );
        },
        enableHiding: false,
        enableSorting: false,
      },
    ],
    [highlightedId, t, locale],
  );

  useEffect(() => {
    if (!highlightedId) return;
    const el = document.getElementById(`customer-row-${highlightedId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedId, customers]);

  return (
    <>
      <DataTable
        bulkActions={(selectedCustomers) => (
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                void copyToClipboard(
                  selectedCustomers.map((customer) => customer.email).join("\n"),
                  t("customers.table.emails"),
                  t,
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <AppIcons.copy data-icon="inline-start" />
              {t("customers.table.copyEmails")}
            </Button>
            <Button
              disabled={!selectedCustomers.some((customer) => customer.phone)}
              onClick={() =>
                void copyToClipboard(
                  selectedCustomers
                    .map((customer) => customer.phone)
                    .filter((phone): phone is string => Boolean(phone))
                    .join("\n"),
                  t("customers.table.phoneNumbers"),
                  t,
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <AppIcons.copy data-icon="inline-start" />
              {t("customers.table.copyPhones")}
            </Button>
          </div>
        )}
        columns={columns}
        data={customers}
        emptyIcon={<AppIcons.user className="size-5" aria-hidden />}
        emptyMessage={t("customers.table.emptyMessage")}
        emptyTitle={t("customers.table.emptyTitle")}
        filteredEmptyMessage={t("customers.table.filteredEmptyMessage")}
        filteredEmptyTitle={t("customers.table.filteredEmptyTitle")}
        getRowId={(row) => row.id}
        isFiltered={hasActiveFilter}
        isLoading={pending}
        selectedSummaryLabel={t("customers.table.selectedSummary")}
        footer={footer}
        toolbar={
          <div className="flex flex-col gap-3">
            <DataTableFilters
              filters={[]}
              onClearAll={() => {
                setSearchValue("");
                pushQuery("");
              }}
            >
              <ListToolbarSearch
                clearLabel={t("common.clearSearch")}
                label={t("customers.table.searchLabel")}
                onChange={(value) => {
                  setSearchValue(value);
                  pushQuery(value);
                }}
                placeholder={t("customers.table.searchPlaceholder")}
                value={searchValue}
              />
            </DataTableFilters>
            <ListResultsStatus
              hasServerFilter={hasActiveFilter}
              pageCount={customers.length}
              pending={pending}
              totalCount={totalCount}
            />
          </div>
        }
      />

      <CustomerFormDialog
        customer={editing ?? undefined}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        open={Boolean(editing)}
        trigger={null}
      />
    </>
  );
}
