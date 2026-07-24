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
import { ListResultsStatus } from "@/components/app/list-results-status";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PromotionEditSheet } from "@/features/promotions/promotion-edit-sheet";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { MerchantPromotion } from "@/lib/merchant-promotions";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { mapPlatformErrorMessage, readPlatformErrorMessage } from "@/lib/platform-api/errors";

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

function formatDiscount(item: MerchantPromotion, t: Translate) {
  if (item.promotionType === "buyget") {
    const buy = item.buyMinQuantity ?? "X";
    const get = item.applyToQuantity ?? "Y";
    return t("promotions.format.buyGet", { buy: String(buy), get: String(get) });
  }
  if (item.targetType === "shipping_methods" && item.method === "percentage" && item.value >= 100) {
    return t("promotions.format.freeShipping");
  }
  return item.method === "percentage"
    ? `${item.value}%`
    : `${item.value} ${item.currencyCode?.toUpperCase() ?? "ETB"}`;
}

function formatTarget(item: MerchantPromotion, t: Translate) {
  if (item.promotionType === "buyget") return t("promotions.format.buyXgetY");
  if (item.targetType === "shipping_methods") return t("promotions.format.shipping");
  if (item.targetType === "items") return t("promotions.format.products");
  return t("promotions.format.order");
}

function isFreeShippingOffer(item: MerchantPromotion) {
  return (
    item.targetType === "shipping_methods" &&
    item.method === "percentage" &&
    item.value >= 100
  );
}

/** Fixed locale so SSR and the browser always render the same string. */
function formatScheduleDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
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
  initialStatus = "all",
  promotions,
  totalCount,
}: {
  footer?: ReactNode;
  initialQuery?: string | undefined;
  initialStatus?: StatusFilter | undefined;
  promotions: MerchantPromotion[];
  totalCount: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(initialQuery);
  // Offer / apply refine the current page. Status is server-side (main filter).
  const [offer, setOffer] = useState<OfferFilter>("all");
  const [apply, setApply] = useState<ApplyFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<MerchantPromotion | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<MerchantPromotion[]>([]);
  const [editing, setEditing] = useState<MerchantPromotion | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setSearchValue(initialQuery);
  }, [initialQuery]);

  const pushServerFilters = useCallback(
    (next: { q?: string; status?: StatusFilter }) => {
      const url = new URL(window.location.href);
      const q = next.q !== undefined ? next.q : initialQuery;
      const status = next.status !== undefined ? next.status : initialStatus;
      if (q.trim()) url.searchParams.set("q", q.trim());
      else url.searchParams.delete("q");
      if (status && status !== "all") url.searchParams.set("status", status);
      else url.searchParams.delete("status");
      url.searchParams.delete("page");
      startTransition(() => {
        router.push(`${url.pathname}?${url.searchParams.toString()}`);
      });
    },
    [initialQuery, initialStatus, router],
  );

  const filtered = useMemo(() => {
    return promotions.filter((item) => {
      const matchesOffer = offer === "all" || matchesOfferFilter(item, offer);
      const matchesApply =
        apply === "all" ||
        (apply === "automatic" ? item.isAutomatic : !item.isAutomatic);
      return matchesOffer && matchesApply;
    });
  }, [apply, offer, promotions]);

  const hasServerFilter = Boolean(initialQuery.trim()) || initialStatus !== "all";
  const hasClientPageFilter = offer !== "all" || apply !== "all";
  const isFiltered = hasServerFilter || hasClientPageFilter;

  const filters: DataTableFilterDefinition[] = [
    {
      defaultValue: "all",
      id: "status",
      label: t("promotions.filter.status.label"),
      onChange: (value) => pushServerFilters({ status: value as StatusFilter }),
      options: [
        { label: t("promotions.filter.status.all"), value: "all" },
        { label: t("promotions.filter.status.active"), value: "active" },
        { label: t("promotions.filter.status.draft"), value: "draft" },
        { label: t("promotions.filter.status.inactive"), value: "inactive" },
      ],
      value: initialStatus,
    },
    {
      defaultValue: "all",
      id: "offer",
      label: t("promotions.filter.offer.label"),
      onChange: (value) => setOffer(value as OfferFilter),
      options: [
        { label: t("promotions.filter.offer.all"), value: "all" },
        { label: t("promotions.filter.offer.order"), value: "order" },
        { label: t("promotions.filter.offer.products"), value: "products" },
        { label: t("promotions.filter.offer.free_shipping"), value: "free_shipping" },
        { label: t("promotions.filter.offer.buyget"), value: "buyget" },
        { label: t("promotions.filter.offer.percentage"), value: "percentage" },
        { label: t("promotions.filter.offer.fixed"), value: "fixed" },
      ],
      value: offer,
    },
    {
      defaultValue: "all",
      id: "apply",
      label: t("promotions.filter.apply.how"),
      onChange: (value) => setApply(value as ApplyFilter),
      options: [
        { label: t("promotions.filter.apply.methodsAll"), value: "all" },
        { label: t("promotions.filter.apply.codeRequired"), value: "code" },
        { label: t("promotions.filter.apply.automatic"), value: "automatic" },
      ],
      value: apply,
    },
  ];

  async function deletePromotions(targets: MerchantPromotion[]) {
    setDeleting(true);
    let deleted = 0;
    let lastFailureMessage: string | null = null;
    for (const item of targets) {
      const response = await fetch(`/admin/promotions/actions/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      }).catch(() => null);
      if (response?.ok) {
        deleted += 1;
        continue;
      }
      lastFailureMessage = await readPlatformErrorMessage(response, {
        fallback: t("promotions.toast.deleteFailed"),
        resource: "Promotion",
      });
    }
    setDeleting(false);
    setDeleteTarget(null);
    setBulkDeleteTargets([]);
    if (deleted === targets.length) {
      toast.success(
        targets.length === 1
          ? t("promotions.toast.deleted")
          : t("promotions.toast.deletedPlural", { count: deleted }),
      );
      router.refresh();
      return;
    }
    if (deleted > 0) {
      toast.error(t("promotions.toast.partialDeleted", { deleted, failed: targets.length - deleted }));
      router.refresh();
      return;
    }
    toast.error(
      lastFailureMessage ??
        mapPlatformErrorMessage(null, {
          fallback: t("promotions.toast.deleteFailed"),
          resource: "Promotion",
        }),
    );
  }

  const columns = useMemo<ColumnDef<MerchantPromotion>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label={t("table.actions.selectAllVisible", { entity: t("taxonomy.entity.promotion.plural").toLowerCase() })}
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={t("table.actions.selectRow", { name: row.original.code })}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          />
        ),
        enableHiding: false,
        enableSorting: false,
      },
      {
        accessorKey: "code",
        header: ({ column }) => <DataTableHeader column={column} title={t("promotions.table.codeHeader")} />,
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
        header: ({ column }) => <DataTableHeader column={column} title={t("table.headers.discount")} />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm">{formatDiscount(row.original, t)}</p>
            <p className="text-xs text-muted-foreground">{formatTarget(row.original, t)}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableHeader column={column} title={t("promotions.filter.status.label")} />,
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge>
            {row.original.isAutomatic ? (
              <Badge variant="outline">{t("promotions.badge.auto")}</Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "usage",
        accessorFn: (item) => item.usageCount,
        header: ({ column }) => <DataTableHeader column={column} title={t("table.headers.usage")} />,
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
        header: ({ column }) => <DataTableHeader column={column} title={t("table.headers.schedule")} />,
        cell: ({ row }) => {
          const item = row.original;
          if (item.endsAt) {
            return (
              <span className="text-sm text-muted-foreground">
                {t("promotions.schedule.ends", { date: formatScheduleDate(item.endsAt) })}
              </span>
            );
          }
          if (item.startsAt) {
            return (
              <span className="text-sm text-muted-foreground">
                {t("promotions.schedule.starts", { date: formatScheduleDate(item.startsAt) })}
              </span>
            );
          }
          return <span className="text-sm text-muted-foreground">{t("promotions.schedule.none")}</span>;
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("table.headers.actions")}</span>,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <RowActionsMenu
              actions={[
                {
                  icon: AppIcons.edit,
                  label: t("promotions.action.edit"),
                  onSelect: () => setEditing(item),
                  type: "button",
                },
                {
                  icon: AppIcons.copy,
                  label: t("promotions.action.copy"),
                  onSelect: () => void copyToClipboard(item.code, t("promotions.table.promotionCode"), t),
                  type: "button",
                },
                { id: "danger", type: "separator" },
                {
                  icon: AppIcons.trash,
                  label: t("table.actions.deletePromotion"),
                  onSelect: () => setDeleteTarget(item),
                  type: "button",
                  variant: "destructive",
                },
              ]}
              label={t("table.actions.openActionsFor", { name: item.code })}
            />
          );
        },
        enableHiding: false,
        enableSorting: false,
      },
    ],
    [setEditing, t],
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
                  t("promotions.table.promotionCodes"),
                  t,
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <AppIcons.copy data-icon="inline-start" />
              {t("promotions.table.copyCodes")}
            </Button>
            <Button
              onClick={() => setBulkDeleteTargets(selected)}
              size="sm"
              type="button"
              variant="destructive-outline"
            >
              <AppIcons.trash data-icon="inline-start" />
              {t("table.actions.deleteSelected")}
            </Button>
          </div>
        )}
        columns={columns}
        data={filtered}
        emptyIcon={<AppIcons.tag className="size-5" aria-hidden />}
        emptyMessage={t("promotions.table.emptyMessage")}
        emptyTitle={t("promotions.table.emptyTitle")}
        filteredEmptyMessage={t("promotions.table.filteredEmptyMessage")}
        filteredEmptyTitle={t("promotions.table.filteredEmptyTitle")}
        getRowId={(item) => item.id}
        isFiltered={isFiltered}
        isLoading={pending}
        selectedSummaryLabel={t("promotions.table.selectedSummary")}
        footer={footer}
        toolbar={
          <div className="flex flex-col gap-3">
            <DataTableFilters
              filters={filters}
              onClearAll={() => {
                setOffer("all");
                setApply("all");
                setSearchValue("");
                pushServerFilters({ q: "", status: "all" });
              }}
            >
              <ListToolbarSearch
                clearLabel={t("promotions.table.clearSearch")}
                label={t("promotions.table.searchLabel")}
                onChange={(value) => {
                  setSearchValue(value);
                  pushServerFilters({ q: value });
                }}
                placeholder={t("promotions.table.searchPlaceholder")}
                value={searchValue}
              />
            </DataTableFilters>
            <ListResultsStatus
              filteredPageCount={filtered.length}
              hasClientPageFilter={hasClientPageFilter}
              hasServerFilter={hasServerFilter}
              pageCount={promotions.length}
              pending={pending}
              totalCount={totalCount}
            />
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

      <ConfirmDialog
        cancelDisabled={deleting}
        confirmDisabled={deleting || !deleteTargets.length}
        confirmLabel={deleting ? t("common.deleting") : t("common.delete")}
        description={
          deleteTargets.length > 1
            ? t("table.actions.deletePromotionsDescription")
            : t("table.actions.deletePromotionDescription", { code: deleteTarget?.code ?? "" })
        }
        eyebrow={t("common.confirm.deleteEyebrow")}
        icon="trash"
        onConfirm={() => void deletePromotions(deleteTargets)}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setDeleteTarget(null);
            setBulkDeleteTargets([]);
          }
        }}
        open={Boolean(deleteTarget) || bulkDeleteTargets.length > 0}
        title={
          deleteTargets.length > 1
            ? t("table.actions.deletePromotionsQuestion", { count: deleteTargets.length })
            : t("table.actions.deletePromotionQuestion")
        }
      />
    </>
  );
}
