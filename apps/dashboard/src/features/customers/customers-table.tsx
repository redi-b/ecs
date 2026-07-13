"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/app/data-table";
import { DataTableFilters } from "@/components/app/data-table-filters";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
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
import { cn } from "@/lib/utils";

function customerDisplayName(customer: MerchantCustomer) {
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email
  );
}

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

export function CustomersTable({
  customers,
  footer,
  highlightCustomerId,
  totalCount,
}: {
  customers: MerchantCustomer[];
  footer?: ReactNode;
  /** When set (e.g. from order detail), flash that row and open edit if present. */
  highlightCustomerId?: string | undefined;
  totalCount: number;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MerchantCustomer | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? customers.filter((item) =>
          `${item.firstName ?? ""} ${item.lastName ?? ""} ${item.email} ${item.phone ?? ""} ${item.companyName ?? ""}`
            .toLowerCase()
            .includes(q),
        )
      : customers;
  }, [customers, query]);

  const columns = useMemo<ColumnDef<MerchantCustomer>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all visible customers"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${customerDisplayName(row.original)}`}
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
        header: ({ column }) => <DataTableHeader column={column} title="Customer" />,
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
        header: ({ column }) => <DataTableHeader column={column} title="Phone" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.phone || "—"}</span>
        ),
      },
      {
        id: "groups",
        header: ({ column }) => <DataTableHeader column={column} title="Groups" />,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.groups.length ? (
              row.original.groups.map((group) => (
                <Badge key={group.id} variant="secondary">
                  {group.name.startsWith("Tenant ") || group.name.startsWith("Shop ")
                    ? "Customer"
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
        header: ({ column }) => <DataTableHeader column={column} title="Addresses" />,
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
                {count} address{count === 1 ? "" : "es"}
              </span>
              {hasDefault ? (
                <Badge className="font-normal" variant="outline">
                  Default set
                </Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableHeader column={column} title="Joined" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
              new Date(row.original.createdAt),
            )}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const customer = row.original;
          return (
            <RowActionsMenu
              actions={[
                {
                  href: dashboardRoutes.customerDetail(customer.id),
                  icon: AppIcons.eye,
                  label: "View details",
                  type: "link",
                },
                {
                  icon: AppIcons.edit,
                  label: "Edit customer",
                  onSelect: () => setEditing(customer),
                  type: "button",
                },
                { id: "copy", type: "separator" },
                {
                  icon: AppIcons.copy,
                  label: "Copy email",
                  onSelect: () => void copyToClipboard(customer.email, "Email"),
                  type: "button",
                },
                {
                  disabled: !customer.phone,
                  icon: AppIcons.copy,
                  label: "Copy phone",
                  onSelect: () => void copyToClipboard(customer.phone ?? "", "Phone"),
                  type: "button",
                },
              ]}
              label={`Open actions for ${customerDisplayName(customer)}`}
            />
          );
        },
        enableHiding: false,
        enableSorting: false,
      },
    ],
    [highlightedId],
  );

  useEffect(() => {
    if (!highlightedId) return;
    const el = document.getElementById(`customer-row-${highlightedId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedId, filtered]);

  return (
    <>
      <DataTable
        bulkActions={(selectedCustomers) => (
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                void copyToClipboard(
                  selectedCustomers.map((customer) => customer.email).join("\n"),
                  "Emails",
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <AppIcons.copy data-icon="inline-start" />
              Copy emails
            </Button>
            <Button
              disabled={!selectedCustomers.some((customer) => customer.phone)}
              onClick={() =>
                void copyToClipboard(
                  selectedCustomers
                    .map((customer) => customer.phone)
                    .filter((phone): phone is string => Boolean(phone))
                    .join("\n"),
                  "Phone numbers",
                )
              }
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
        data={filtered}
        emptyMessage="Customers will appear here after their first order or when you add them."
        emptyTitle="No customers yet"
        filteredEmptyMessage="Try another name, email, phone, or company."
        filteredEmptyTitle="No matching customers"
        getRowId={(row) => row.id}
        isFiltered={Boolean(query.trim())}
        selectedSummaryLabel={(count) => `customer${count === 1 ? "" : "s"} selected`}
        footer={footer}
        toolbar={
          <div className="flex flex-col gap-3">
            <DataTableFilters filters={[]} onClearAll={() => setQuery("")}>
              <ListToolbarSearch
                clearLabel="Clear customer search"
                label="Search customers"
                onChange={setQuery}
                placeholder="Search customers"
                value={query}
              />
            </DataTableFilters>
            <p className="text-sm text-muted-foreground">
              {query.trim()
                ? `${filtered.length} of ${customers.length} on this page`
                : `${customers.length} on this page, ${totalCount} total`}
            </p>
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
