"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/app/access-context";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import {
  type DataTableFilterDefinition,
  DataTableFilters,
} from "@/components/app/data-table-filters";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
import { EcsArtwork } from "@/components/app/ecs-brand";
import { ListResultsStatus } from "@/components/app/list-results-status";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { type ResourceRowActions, RowActionsMenu } from "@/components/app/row-actions-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PromotionEditSheet } from "@/features/promotions/promotion-edit-sheet";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { MerchantPromotion } from "@/lib/merchant-promotions";
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
type ScheduleFilter = "all" | "scheduled" | "current" | "expired" | "unscheduled";

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

/** Fixed locale so SSR and the browser always render the same string. */
function formatScheduleDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusBadgeVariant(status: MerchantPromotion["status"]) {
  if (status === "active") return "default" as const;
  if (status === "draft") return "outline" as const;
  return "secondary" as const;
}

export function PromotionsManager({
  footer,
  initialQuery = "",
  initialApply = "all",
  initialSchedule = "all",
  initialOffer = "all",
  initialStatus = "all",
  promotions,
  totalCount,
}: {
  footer?: ReactNode;
  initialQuery?: string | undefined;
  initialApply?: ApplyFilter | undefined;
  initialSchedule?: ScheduleFilter | undefined;
  initialOffer?: OfferFilter | undefined;
  initialStatus?: StatusFilter | undefined;
  promotions: MerchantPromotion[];
  totalCount: number;
}) {
  const { t } = useI18n();
  const canManage = usePermission("promotions.manage");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(initialQuery);
  const offer = initialOffer;
  const apply = initialApply;
  const [deleteTarget, setDeleteTarget] = useState<MerchantPromotion | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<MerchantPromotion[]>([]);
  const [editing, setEditing] = useState<MerchantPromotion | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setSearchValue(initialQuery);
  }, [initialQuery]);

  const pushServerFilters = useCallback(
    (next: {
      schedule?: ScheduleFilter;
      apply?: ApplyFilter;
      offer?: OfferFilter;
      q?: string;
      status?: StatusFilter;
    }) => {
      const url = new URL(window.location.href);
      const q = next.q !== undefined ? next.q : initialQuery;
      const status = next.status !== undefined ? next.status : initialStatus;
      if (q.trim()) url.searchParams.set("q", q.trim());
      else url.searchParams.delete("q");
      if (status && status !== "all") url.searchParams.set("status", status);
      else url.searchParams.delete("status");
      setPromotionUrlFilter(url, "apply", next.apply ?? apply);
      setPromotionUrlFilter(url, "offer", next.offer ?? offer);
      setPromotionUrlFilter(url, "schedule", next.schedule ?? initialSchedule);
      url.searchParams.delete("page");
      startTransition(() => {
        router.push(`${url.pathname}?${url.searchParams.toString()}`);
      });
    },
    [apply, initialQuery, initialStatus, initialSchedule, offer, router],
  );

  const filtered = promotions;

  const hasServerFilter =
    Boolean(initialQuery.trim()) ||
    initialStatus !== "all" ||
    offer !== "all" ||
    apply !== "all" ||
    initialSchedule !== "all";
  const hasClientPageFilter = false;
  const isFiltered = hasServerFilter || offer !== "all" || apply !== "all";

  const promotionRowActions = useCallback(
    (item: MerchantPromotion): ResourceRowActions => ({
      actions: [
        ...(canManage
          ? [
              {
                icon: AppIcons.edit,
                label: t("promotions.action.edit"),
                onSelect: () => setEditing(item),
                type: "button" as const,
              },
            ]
          : []),
        ...(!item.isAutomatic
          ? [
              {
                icon: AppIcons.copy,
                label: t("promotions.action.copy"),
                onSelect: () =>
                  void copyToClipboard(item.code, t("promotions.table.promotionCode"), t),
                type: "button" as const,
              },
            ]
          : []),
        ...(canManage
          ? [
              { id: "danger", type: "separator" as const },
              {
                icon: AppIcons.trash,
                label: t("table.actions.deletePromotion"),
                onSelect: () => setDeleteTarget(item),
                type: "button" as const,
                variant: "destructive" as const,
              },
            ]
          : []),
      ],
      label: t("table.actions.openActionsFor", { name: item.code }),
    }),
    [canManage, t],
  );

  const filters: DataTableFilterDefinition[] = [
    {
      id: "schedule",
      defaultValue: "all",
      label: t("promotions.filter.schedule.label"),
      value: initialSchedule,
      onChange: (value) => pushServerFilters({ schedule: value as ScheduleFilter }),
      options: [
        { value: "all", label: t("promotions.filter.schedule.all") },
        { value: "scheduled", label: t("promotions.filter.schedule.scheduled") },
        { value: "current", label: t("promotions.filter.schedule.current") },
        { value: "expired", label: t("promotions.filter.schedule.expired") },
        { value: "unscheduled", label: t("promotions.filter.schedule.unscheduled") },
      ],
    },
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
      onChange: (value) => pushServerFilters({ offer: value as OfferFilter }),
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
      onChange: (value) => pushServerFilters({ apply: value as ApplyFilter }),
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
      toast.error(
        t("promotions.toast.partialDeleted", { deleted, failed: targets.length - deleted }),
      );
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
            aria-label={t("table.actions.selectAllVisible", {
              entity: t("taxonomy.entity.promotion.plural").toLowerCase(),
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
        header: ({ column }) => (
          <DataTableHeader column={column} title={t("promotions.table.codeHeader")} />
        ),
        cell: ({ row }) => (
          <button
            className="flex flex-col items-start text-left transition-colors hover:text-primary"
            onClick={() => setEditing(row.original)}
            type="button"
          >
            <span className="font-mono text-sm font-medium">
              {row.original.isAutomatic ? t("promotions.table.automaticCode") : row.original.code}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.original.isAutomatic
                ? t("promotions.table.automaticCodeHelp")
                : t("promotions.table.customerCode")}
            </span>
          </button>
        ),
      },
      {
        id: "discount",
        accessorFn: (item) => item.value,
        header: ({ column }) => (
          <DataTableHeader column={column} title={t("table.headers.discount")} />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm">{formatDiscount(row.original, t)}</p>
            <p className="text-xs text-muted-foreground">{formatTarget(row.original, t)}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableHeader column={column} title={t("promotions.filter.status.label")} />
        ),
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
        header: ({ column }) => (
          <DataTableHeader column={column} title={t("table.headers.usage")} />
        ),
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
        header: ({ column }) => (
          <DataTableHeader column={column} title={t("table.headers.schedule")} />
        ),
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
          return (
            <span className="text-sm text-muted-foreground">{t("promotions.schedule.none")}</span>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("table.headers.actions")}</span>,
        cell: ({ row }) => <RowActionsMenu {...promotionRowActions(row.original)} />,
        enableHiding: false,
        enableSorting: false,
      },
    ],
    [promotionRowActions, t],
  );

  const deleteTargets = deleteTarget ? [deleteTarget] : bulkDeleteTargets;

  return (
    <>
      <DataTable
        enableSorting={false}
        bulkActions={(selected) => (
          <div className="flex items-center gap-2">
            <Button
              disabled={selected.every((item) => item.isAutomatic)}
              onClick={() =>
                void copyToClipboard(
                  selected
                    .filter((item) => !item.isAutomatic)
                    .map((item) => item.code)
                    .join("\n"),
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
            {canManage ? (
              <Button
                onClick={() => setBulkDeleteTargets(selected)}
                size="sm"
                type="button"
                variant="destructive-outline"
              >
                <AppIcons.trash data-icon="inline-start" />
                {t("table.actions.deleteSelected")}
              </Button>
            ) : null}
          </div>
        )}
        columns={columns}
        data={filtered}
        emptyIcon={<EcsArtwork kind="promotions" />}
        emptyMessage={t("promotions.table.emptyMessage")}
        emptyTitle={t("promotions.table.emptyTitle")}
        filteredEmptyMessage={t("promotions.table.filteredEmptyMessage")}
        filteredEmptyTitle={t("promotions.table.filteredEmptyTitle")}
        getRowId={(item) => item.id}
        isFiltered={isFiltered}
        isLoading={pending}
        rowActions={promotionRowActions}
        selectedSummaryLabel={t("promotions.table.selectedSummary")}
        footer={footer}
        toolbar={
          <div className="flex flex-col gap-3">
            <DataTableFilters
              filters={filters}
              onClearAll={() => {
                setSearchValue("");
                pushServerFilters({
                  schedule: "all",
                  apply: "all",
                  offer: "all",
                  q: "",
                  status: "all",
                });
              }}
            >
              <ListToolbarSearch
                clearLabel={t("common.clearSearch")}
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

function setPromotionUrlFilter(url: URL, key: "apply" | "offer" | "schedule", value: string) {
  if (value === "all") url.searchParams.delete(key);
  else url.searchParams.set(key, value);
}
