"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
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
import { PromotionEditSheet } from "@/features/promotions/promotion-edit-sheet";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { MerchantPromotion } from "@/lib/merchant-promotions";

type StatusFilter = "all" | "active" | "draft" | "inactive";
type OfferFilter =
  | "all"
  | "order"
  | "products"
  | "shipping"
  | "buyget"
  | "free_shipping"
  | "percentage"
  | "fixed";
type ApplyFilter = "all" | "code" | "automatic";

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
  if (item.promotionType === "buyget") {
    const buy = item.buyMinQuantity ?? "X";
    const get = item.applyToQuantity ?? "Y";
    return `Buy ${buy} get ${get}`;
  }
  if (item.targetType === "shipping_methods" && item.method === "percentage" && item.value >= 100) {
    return "Free shipping";
  }
  return item.method === "percentage"
    ? `${item.value}%`
    : `${item.value} ${item.currencyCode?.toUpperCase() ?? "ETB"}`;
}

function formatTarget(item: MerchantPromotion) {
  if (item.promotionType === "buyget") return "Buy X get Y";
  if (item.targetType === "shipping_methods") return "Shipping";
  if (item.targetType === "items") return "Products";
  return "Order";
}

function isFreeShippingOffer(item: MerchantPromotion) {
  return (
    item.targetType === "shipping_methods" &&
    item.method === "percentage" &&
    item.value >= 100
  );
}

function matchesOfferFilter(item: MerchantPromotion, offer: OfferFilter) {
  switch (offer) {
    case "all":
      return true;
    case "buyget":
      return item.promotionType === "buyget";
    case "free_shipping":
      return isFreeShippingOffer(item);
    case "order":
      return item.promotionType !== "buyget" && item.targetType === "order";
    case "products":
      return item.promotionType !== "buyget" && item.targetType === "items";
    case "shipping":
      return item.targetType === "shipping_methods";
    case "percentage":
      return item.method === "percentage" && !isFreeShippingOffer(item);
    case "fixed":
      return item.method === "fixed";
    default:
      return true;
  }
}

function statusBadgeVariant(status: MerchantPromotion["status"]) {
  if (status === "active") return "default" as const;
  if (status === "draft") return "outline" as const;
  return "secondary" as const;
}

export function PromotionsManager({
  footer,
  initialQuery = "",
  promotions,
  totalCount,
}: {
  footer?: ReactNode;
  initialQuery?: string | undefined;
  promotions: MerchantPromotion[];
  totalCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(initialQuery);
  // Status / offer / apply refine the current server page until dedicated API filters exist.
  const [status, setStatus] = useState<StatusFilter>("all");
  const [offer, setOffer] = useState<OfferFilter>("all");
  const [apply, setApply] = useState<ApplyFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<MerchantPromotion | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<MerchantPromotion[]>([]);
  const [editing, setEditing] = useState<MerchantPromotion | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setSearchValue(initialQuery);
  }, [initialQuery]);

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

  const filtered = useMemo(() => {
    return promotions.filter((item) => {
      const matchesStatus = status === "all" || item.status === status;
      const matchesOffer = offer === "all" || matchesOfferFilter(item, offer);
      const matchesApply =
        apply === "all" ||
        (apply === "automatic" ? item.isAutomatic : !item.isAutomatic);
      return matchesStatus && matchesOffer && matchesApply;
    });
  }, [apply, offer, promotions, status]);

  const hasServerFilter = Boolean(initialQuery.trim());
  const hasClientPageFilter = status !== "all" || offer !== "all" || apply !== "all";
  const isFiltered = hasServerFilter || hasClientPageFilter;

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
      id: "offer",
      label: "Offer",
      onChange: (value) => setOffer(value as OfferFilter),
      options: [
        { label: "All offers", value: "all" },
        { label: "Order discount", value: "order" },
        { label: "Product discount", value: "products" },
        { label: "Free shipping", value: "free_shipping" },
        { label: "Buy X get Y", value: "buyget" },
        { label: "Percentage", value: "percentage" },
        { label: "Fixed amount", value: "fixed" },
      ],
      value: offer,
    },
    {
      defaultValue: "all",
      id: "apply",
      label: "How it applies",
      onChange: (value) => setApply(value as ApplyFilter),
      options: [
        { label: "All methods", value: "all" },
        { label: "Promotion code", value: "code" },
        { label: "Automatic", value: "automatic" },
      ],
      value: apply,
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
          <button
            className="font-mono text-sm font-medium text-foreground transition-colors hover:text-primary"
            onClick={() => setEditing(row.original)}
            type="button"
          >
            {row.original.code}
          </button>
        ),
      },
      {
        id: "discount",
        accessorFn: (item) => item.value,
        header: ({ column }) => <DataTableHeader column={column} title="Discount" />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm">{formatDiscount(row.original)}</p>
            <p className="text-xs text-muted-foreground">{formatTarget(row.original)}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge>
            {row.original.isAutomatic ? (
              <Badge variant="outline">Auto</Badge>
            ) : null}
          </div>
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
                  icon: AppIcons.edit,
                  label: "Edit promotion",
                  onSelect: () => setEditing(item),
                  type: "button",
                },
                {
                  icon: AppIcons.copy,
                  label: "Copy code",
                  onSelect: () => void copyToClipboard(item.code, "Promotion code"),
                  type: "button",
                },
                { id: "danger", type: "separator" },
                {
                  icon: AppIcons.trash,
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
    // setEditing is stable enough for column identity in this manager.
    [setEditing],
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
                setStatus("all");
                setOffer("all");
                setApply("all");
                setSearchValue("");
                pushQuery("");
              }}
            >
              <ListToolbarSearch
                clearLabel="Clear promotion search"
                label="Search promotions"
                onChange={(value) => {
                  setSearchValue(value);
                  pushQuery(value);
                }}
                placeholder="Search promotion codes…"
                value={searchValue}
              />
            </DataTableFilters>
            <p className="text-sm text-muted-foreground">
              {pending
                ? "Updating…"
                : hasClientPageFilter
                  ? `${filtered.length} of ${promotions.length} on this page`
                  : hasServerFilter
                    ? `${promotions.length} of ${totalCount} matching`
                    : `${promotions.length} on this page, ${totalCount} total`}
            </p>
          </div>
        }
      />

      <PromotionEditSheet
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        open={Boolean(editing)}
        promotion={editing}
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
