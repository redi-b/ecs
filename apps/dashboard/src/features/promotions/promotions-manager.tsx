"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { MerchantPromotion } from "@/lib/merchant-promotions";

type StatusFilter = "all" | "active" | "draft" | "inactive";
type MethodFilter = "all" | "percentage" | "fixed";

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

function formatDiscount(item: MerchantPromotion) {
  return item.method === "percentage"
    ? `${item.value}%`
    : `${item.value} ${item.currencyCode?.toUpperCase() ?? "ETB"}`;
}

function statusBadgeVariant(status: MerchantPromotion["status"]) {
  if (status === "active") return "default" as const;
  if (status === "draft") return "outline" as const;
  return "secondary" as const;
}

export function PromotionsManager({
  footer,
  promotions,
  totalCount,
}: {
  footer?: ReactNode;
  promotions: MerchantPromotion[];
  totalCount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<MerchantPromotion | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<MerchantPromotion[]>([]);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return promotions.filter((item) => {
      const matchesQuery =
        !normalized ||
        item.code.toLowerCase().includes(normalized) ||
        item.status.includes(normalized);
      const matchesStatus = status === "all" || item.status === status;
      const matchesMethod = method === "all" || item.method === method;
      return matchesQuery && matchesStatus && matchesMethod;
    });
  }, [method, promotions, query, status]);

  const isFiltered = Boolean(query.trim() || status !== "all" || method !== "all");

  const filters: DataTableFilterDefinition[] = [
    {
      defaultValue: "all",
      id: "status",
      label: "Status",
      onChange: (value) => setStatus(value as StatusFilter),
      options: [
        { label: "All statuses", value: "all" },
        { label: "Active", value: "active" },
        { label: "Draft", value: "draft" },
        { label: "Inactive", value: "inactive" },
      ],
      value: status,
    },
    {
      defaultValue: "all",
      id: "method",
      label: "Discount type",
      onChange: (value) => setMethod(value as MethodFilter),
      options: [
        { label: "All types", value: "all" },
        { label: "Percentage", value: "percentage" },
        { label: "Fixed amount", value: "fixed" },
      ],
      value: method,
    },
  ];

  async function deletePromotions(targets: MerchantPromotion[]) {
    setDeleting(true);
    let deleted = 0;
    for (const item of targets) {
      const response = await fetch(`/admin/promotions/actions/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      }).catch(() => null);
      if (response?.ok) deleted += 1;
    }
    setDeleting(false);
    setDeleteTarget(null);
    setBulkDeleteTargets([]);
    if (deleted === targets.length) {
      toast.success(
        targets.length === 1
          ? "Promotion deleted."
          : `${deleted} promotions deleted.`,
      );
      router.refresh();
      return;
    }
    if (deleted > 0) {
      toast.error(`${deleted} deleted, ${targets.length - deleted} could not be removed.`);
      router.refresh();
      return;
    }
    toast.error("Promotion could not be deleted.");
  }

  const columns = useMemo<ColumnDef<MerchantPromotion>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all visible promotions"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.code}`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          />
        ),
        enableHiding: false,
        enableSorting: false,
      },
      {
        accessorKey: "code",
        header: ({ column }) => <DataTableHeader column={column} title="Code" />,
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium">{row.original.code}</span>
        ),
      },
      {
        id: "discount",
        accessorFn: (item) => item.value,
        header: ({ column }) => <DataTableHeader column={column} title="Discount" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDiscount(row.original)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge>
        ),
      },
      {
        id: "usage",
        accessorFn: (item) => item.usageCount,
        header: ({ column }) => <DataTableHeader column={column} title="Usage" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.usageCount}
            {row.original.usageLimit != null ? ` / ${row.original.usageLimit}` : ""}
          </span>
        ),
      },
      {
        id: "schedule",
        accessorFn: (item) => item.endsAt ?? item.startsAt ?? "",
        header: ({ column }) => <DataTableHeader column={column} title="Schedule" />,
        cell: ({ row }) => {
          const item = row.original;
          if (item.endsAt) {
            return (
              <span className="text-sm text-muted-foreground">
                Ends {new Date(item.endsAt).toLocaleDateString()}
              </span>
            );
          }
          if (item.startsAt) {
            return (
              <span className="text-sm text-muted-foreground">
                Starts {new Date(item.startsAt).toLocaleDateString()}
              </span>
            );
          }
          return <span className="text-sm text-muted-foreground">No schedule</span>;
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <RowActionsMenu
              actions={[
                {
                  label: "Copy code",
                  onSelect: () => void copyToClipboard(item.code, "Promotion code"),
                  type: "button",
                },
                {
                  label: "Copy promotion ID",
                  onSelect: () => void copyToClipboard(item.id, "Promotion ID"),
                  type: "button",
                },
                { id: "danger", type: "separator" },
                {
                  label: "Delete promotion",
                  onSelect: () => setDeleteTarget(item),
                  type: "button",
                  variant: "destructive",
                },
              ]}
              label={`Open actions for ${item.code}`}
            />
          );
        },
        enableHiding: false,
        enableSorting: false,
      },
    ],
    [],
  );

  const deleteTargets = deleteTarget ? [deleteTarget] : bulkDeleteTargets;

  return (
    <>
      <DataTable
        bulkActions={(selected) => (
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                void copyToClipboard(
                  selected.map((item) => item.code).join("\n"),
                  "Promotion codes",
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
              onClick={() => setBulkDeleteTargets(selected)}
              size="sm"
              type="button"
              variant="destructive"
            >
              <AppIcons.trash data-icon="inline-start" />
              Delete selected
            </Button>
          </div>
        )}
        columns={columns}
        data={filtered}
        emptyMessage="Create a code for your next campaign. Redemption limits and schedules keep discounts intentional."
        emptyTitle="No promotions yet"
        filteredEmptyMessage="No promotions match the current search or filters."
        filteredEmptyTitle="No matching promotions"
        getRowId={(item) => item.id}
        isFiltered={isFiltered}
        selectedSummaryLabel={(count) => `promotion${count === 1 ? "" : "s"} selected`}
        footer={footer}
        toolbar={
          <div className="flex flex-col gap-3">
            <DataTableFilters
              filters={filters}
              onClearAll={() => {
                setQuery("");
                setStatus("all");
                setMethod("all");
              }}
            >
              <ListToolbarSearch
                clearLabel="Clear promotion search"
                label="Search promotions"
                onChange={setQuery}
                placeholder="Search promotion codes…"
                value={query}
              />
            </DataTableFilters>
            <p className="text-sm text-muted-foreground">
              {isFiltered
                ? `${filtered.length} of ${promotions.length} on this page`
                : `${promotions.length} on this page, ${totalCount} total`}
            </p>
          </div>
        }
      />

      <AlertDialog
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setDeleteTarget(null);
            setBulkDeleteTargets([]);
          }
        }}
        open={Boolean(deleteTarget) || bulkDeleteTargets.length > 0}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargets.length > 1
                ? `Delete ${deleteTargets.length} promotions?`
                : "Delete promotion?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargets.length > 1
                ? "Selected promotion codes will stop working immediately. This cannot be undone."
                : `“${deleteTarget?.code ?? "This code"}” will stop working immediately. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting || !deleteTargets.length}
              onClick={(event) => {
                event.preventDefault();
                void deletePromotions(deleteTargets);
              }}
              variant="destructive"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
