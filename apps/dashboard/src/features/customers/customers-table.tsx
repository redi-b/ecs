"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
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
import { dashboardRoutes } from "@/lib/routes";

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
  totalCount,
}: {
  customers: MerchantCustomer[];
  footer?: ReactNode;
  totalCount: number;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MerchantCustomer | null>(null);

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
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              className="font-medium hover:underline"
              href={dashboardRoutes.customerDetail(row.original.id)}
            >
              {customerDisplayName(row.original)}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
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
                  {group.name.startsWith("Tenant ") ? "Customer" : group.name}
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
                  label: "View details",
                  type: "link",
                },
                {
                  label: "Edit customer",
                  onSelect: () => setEditing(customer),
                  type: "button",
                },
                { id: "copy", type: "separator" },
                {
                  label: "Copy email",
                  onSelect: () => void copyToClipboard(customer.email, "Email"),
                  type: "button",
                },
                {
                  label: "Copy customer ID",
                  onSelect: () => void copyToClipboard(customer.id, "Customer ID"),
                  type: "button",
                },
                {
                  disabled: !customer.phone,
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
    [],
  );

  return (
    <>
      <DataTable
        bulkActions={(selectedCustomers) => (
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                void copyToClipboard(
                  selectedCustomers.map((customer) => customer.id).join("\n"),
                  "Customer IDs",
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <AppIcons.copy data-icon="inline-start" />
              Copy IDs
            </Button>
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
