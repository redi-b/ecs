"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/app/data-table";
import { DataTableBulkBar } from "@/components/app/data-table-bulk-bar";
import {
  type DataTableFilterDefinition,
  DataTableFilters,
} from "@/components/app/data-table-filters";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
import { ListResultsStatus } from "@/components/app/list-results-status";
import { ListToolbarSearch, ListViewToggle } from "@/components/app/list-toolbar";
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/provider";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { MediaAsset } from "@/lib/merchant-media";
import { cn } from "@/lib/utils";
import { MediaEditSheet } from "./media-edit-sheet";
import {
  filterAndSortMediaAssets,
  formatBytes,
  formatMimeLabel,
  hasActiveMediaFilters,
  type MediaOrientationFilter,
  type MediaSizeFilter,
  type MediaSort,
  mediaAssetDimensionsLabel,
} from "./media-helpers";
import { MediaLightbox } from "./media-lightbox";

type MediaView = "grid" | "list";

export function MediaLibrary({
  assets,
  footer,
  initialMimeType = "all",
  initialQuery = "",
  onChanged,
  pageCount,
  totalCount,
}: {
  assets: MediaAsset[];
  footer?: ReactNode;
  initialMimeType?: string | undefined;
  initialQuery?: string | undefined;
  onChanged: () => void;
  pageCount: number;
  totalCount: number;
}) {
  const { formatDate, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(initialQuery);
  // Size / orientation / sort refine the current page. Type + search are server-side.
  const [size, setSize] = useState<MediaSizeFilter>("all");
  const [orientation, setOrientation] = useState<MediaOrientationFilter>("all");
  const [sort, setSort] = useState<MediaSort>("newest");
  const [view, setView] = useState<MediaView>("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<MediaAsset[]>([]);

  useEffect(() => {
    setSearchValue(initialQuery);
  }, [initialQuery]);

  const pushServerFilters = useCallback(
    (next: { q?: string; mimeType?: string }) => {
      const url = new URL(window.location.href);
      const q = next.q !== undefined ? next.q : initialQuery;
      const mimeType = next.mimeType !== undefined ? next.mimeType : initialMimeType;
      if (q.trim()) url.searchParams.set("q", q.trim());
      else url.searchParams.delete("q");
      if (mimeType && mimeType !== "all") url.searchParams.set("mimeType", mimeType);
      else url.searchParams.delete("mimeType");
      url.searchParams.delete("page");
      startTransition(() => {
        router.push(`${url.pathname}?${url.searchParams.toString()}`);
      });
    },
    [initialMimeType, initialQuery, router],
  );

  const filtered = useMemo(
    () =>
      filterAndSortMediaAssets(assets, {
        orientation,
        query: "",
        size,
        sort,
        type: "all",
      }),
    [assets, orientation, size, sort],
  );

  const hasServerFilter =
    Boolean(initialQuery.trim()) || (initialMimeType !== "all" && Boolean(initialMimeType));
  const hasClientPageFilter = hasActiveMediaFilters({
    orientation,
    query: "",
    size,
    sort,
    type: "all",
  });
  const isFiltered = hasServerFilter || hasClientPageFilter;
  const allPageSelected =
    filtered.length > 0 && filtered.every((asset) => selectedIds.has(asset.id));
  const selectedAssets = filtered.filter((asset) => selectedIds.has(asset.id));

  const filters: DataTableFilterDefinition[] = [
    {
      defaultValue: "all",
      id: "type",
      label: t("media.type"),
      onChange: (value) => pushServerFilters({ mimeType: value }),
      options: [
        { label: t("media.allTypes"), value: "all" },
        { label: "JPEG", value: "image/jpeg" },
        { label: "PNG", value: "image/png" },
        { label: "WebP", value: "image/webp" },
        { label: "AVIF", value: "image/avif" },
        { label: "GIF", value: "image/gif" },
      ],
      value: initialMimeType || "all",
    },
    {
      defaultValue: "all",
      id: "size",
      label: t("media.fileSize"),
      onChange: (value) => setSize(value as MediaSizeFilter),
      options: [
        { label: t("media.allSizes"), value: "all" },
        { label: t("media.sizeSmall"), value: "small" },
        { label: t("media.sizeMedium"), value: "medium" },
        { label: t("media.sizeLarge"), value: "large" },
      ],
      value: size,
    },
    {
      defaultValue: "all",
      id: "orientation",
      label: t("media.orientation"),
      onChange: (value) => setOrientation(value as MediaOrientationFilter),
      options: [
        { label: t("media.allOrientations"), value: "all" },
        { label: t("media.landscape"), value: "landscape" },
        { label: t("media.portrait"), value: "portrait" },
        { label: t("media.square"), value: "square" },
      ],
      value: orientation,
    },
    {
      defaultValue: "newest",
      id: "sort",
      label: t("media.sort"),
      onChange: (value) => setSort(value as MediaSort),
      options: [
        { label: t("media.sortNewest"), value: "newest" },
        { label: t("media.sortOldest"), value: "oldest" },
        { label: t("media.sortNameAsc"), value: "name_asc" },
        { label: t("media.sortNameDesc"), value: "name_desc" },
        { label: t("media.sortLargest"), value: "largest" },
        { label: t("media.sortSmallest"), value: "smallest" },
      ],
      value: sort,
    },
  ];

  function clearFilters() {
    setSearchValue("");
    setSize("all");
    setOrientation("all");
    setSort("newest");
    pushServerFilters({ q: "", mimeType: "all" });
  }

  function toggleSelected(assetId: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(assetId);
      else next.delete(assetId);
      return next;
    });
  }

  function toggleSelectPage(selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const asset of filtered) {
        if (selected) next.add(asset.id);
        else next.delete(asset.id);
      }
      return next;
    });
  }

  async function copyUrls(targets: MediaAsset[]) {
    const urls = targets.map((asset) => asset.publicUrl).filter(Boolean) as string[];
    if (!urls.length) {
      toast.error(t("media.noUrl"));
      return;
    }
    try {
      const copied = await copyTextToClipboard(urls.join("\n"));
      if (!copied) {
        toast.error(t("media.noUrl"));
        return;
      }
      toast.success(
        urls.length === 1 ? t("media.urlCopied") : t("media.urlsCopied", { count: urls.length }),
      );
    } catch {
      toast.error(t("media.noUrl"));
    }
  }

  async function downloadAsset(asset: MediaAsset) {
    if (!asset.publicUrl) {
      toast.error(t("media.noUrl"));
      return;
    }
    try {
      const response = await fetch(asset.publicUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = asset.filename || asset.displayName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(asset.publicUrl, "_blank", "noopener,noreferrer");
    }
  }

  function confirmDelete(targets: MediaAsset[]) {
    if (!targets.length) return;

    // Close the confirm dialog immediately; progress lives in a toast.
    setDeleteTarget(null);
    setBulkDeleteTargets([]);
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const asset of targets) next.delete(asset.id);
      return next;
    });

    const deletePromise = (async () => {
      let deleted = 0;
      let failed = 0;
      for (const asset of targets) {
        const response = await fetch(`/admin/media/assets/${encodeURIComponent(asset.id)}`, {
          method: "DELETE",
        });
        if (response.ok) deleted += 1;
        else failed += 1;
      }

      if (deleted > 0) onChanged();

      if (deleted && !failed) return { deleted };
      if (deleted && failed) {
        throw new Error(t("media.batchDeletePartial", { deleted, failed }));
      }
      throw new Error(
        targets.length === 1 ? t("media.inUseError") : t("media.deleteError"),
      );
    })();

    toast.promise(deletePromise, {
      loading:
        targets.length === 1
          ? t("media.deleting")
          : t("media.deletingMany", { count: targets.length }),
      success: ({ deleted }) =>
        targets.length === 1 ? t("media.deleted") : t("media.batchDeleted", { count: deleted }),
      error: (error) =>
        error instanceof Error ? error.message : t("media.deleteError"),
    });
  }

  function openLightbox(asset: MediaAsset) {
    const index = filtered.findIndex((item) => item.id === asset.id);
    if (index >= 0) setLightboxIndex(index);
  }

  function assetActions(asset: MediaAsset) {
    return [
      {
        icon: AppIcons.expand,
        label: t("media.openImage"),
        onSelect: () => openLightbox(asset),
        type: "button" as const,
      },
      {
        icon: AppIcons.edit,
        label: t("media.editDetails"),
        onSelect: () => setEditing(asset),
        type: "button" as const,
      },
      {
        disabled: !asset.publicUrl,
        icon: AppIcons.copy,
        label: t("media.copyUrl"),
        onSelect: () => void copyUrls([asset]),
        type: "button" as const,
      },
      {
        disabled: !asset.publicUrl,
        icon: AppIcons.externalLink,
        label: t("media.openInNewTab"),
        onSelect: () => {
          if (asset.publicUrl) window.open(asset.publicUrl, "_blank", "noopener,noreferrer");
        },
        type: "button" as const,
      },
      {
        disabled: !asset.publicUrl,
        icon: AppIcons.download,
        label: t("media.download"),
        onSelect: () => void downloadAsset(asset),
        type: "button" as const,
      },
      { id: "danger", type: "separator" as const },
      {
        icon: AppIcons.trash,
        label: t("media.delete"),
        onSelect: () => {
          setBulkDeleteTargets([]);
          setDeleteTarget(asset);
        },
        type: "button" as const,
        variant: "destructive" as const,
      },
    ];
  }

  const columns: ColumnDef<MediaAsset>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label={t("media.selectAll")}
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={t("media.selectAsset", { name: row.original.displayName })}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      accessorKey: "displayName",
      header: ({ column }) => <DataTableHeader column={column} title={t("media.file")} />,
      cell: ({ row }) => {
        const asset = row.original;
        const dimensions = mediaAssetDimensionsLabel(asset);
        return (
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="relative shrink-0 overflow-hidden rounded-lg border"
              onClick={() => openLightbox(asset)}
              type="button"
            >
              {/* biome-ignore lint/performance/noImgElement: Runtime object-storage media. */}
              <img alt="" className="size-11 object-cover" src={asset.publicUrl ?? ""} />
            </button>
            <div className="min-w-0">
              <button
                className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                onClick={() => setEditing(asset)}
                type="button"
              >
                {asset.displayName}
              </button>
              <p className="truncate text-xs text-muted-foreground">
                {dimensions ? `${dimensions} · ` : ""}
                {asset.filename}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "mimeType",
      header: ({ column }) => <DataTableHeader column={column} title={t("media.type")} />,
      cell: ({ row }) => (
        <Badge className="font-normal tabular-nums" variant="secondary">
          {formatMimeLabel(row.original.mimeType)}
        </Badge>
      ),
    },
    {
      accessorKey: "byteSize",
      header: ({ column }) => <DataTableHeader column={column} title={t("media.size")} />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatBytes(row.original.byteSize)}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableHeader column={column} title={t("media.added")} />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(new Date(row.original.createdAt))}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("media.actions")}</span>,
      cell: ({ row }) => (
        <RowActionsMenu actions={assetActions(row.original)} label={t("media.rowActions")} />
      ),
      enableSorting: false,
    },
  ];

  const toolbar = (
    <div className="flex flex-col gap-3">
      <DataTableFilters
        actions={
          <ListViewToggle
            onChange={(next) => {
              setView(next);
              setSelectedIds(new Set());
            }}
            options={[
              { icon: AppIcons.grid, label: t("media.gridView"), value: "grid" },
              { icon: AppIcons.list, label: t("media.listView"), value: "list" },
            ]}
            value={view}
          />
        }
        filters={filters}
        onClearAll={clearFilters}
      >
        <ListToolbarSearch
          clearLabel={t("media.clearFilters")}
          label={t("media.search")}
          onChange={(value) => {
            setSearchValue(value);
            pushServerFilters({ q: value });
          }}
          placeholder={t("media.searchPlaceholder")}
          value={searchValue}
        />
      </DataTableFilters>
      <ListResultsStatus
        filteredPageCount={filtered.length}
        hasClientPageFilter={hasClientPageFilter}
        hasServerFilter={hasServerFilter}
        pageCount={assets.length}
        pending={pending}
        totalCount={totalCount}
      />
    </div>
  );

  const bulkActions = (targets: MediaAsset[]) => (
    <div className="flex items-center gap-1">
      <Button onClick={() => void copyUrls(targets)} size="sm" type="button" variant="outline">
        <AppIcons.copy data-icon="inline-start" />
        {t("media.copyUrls")}
      </Button>
      <Button
        onClick={() => {
          setBulkDeleteTargets(targets);
          setDeleteTarget(null);
        }}
        size="sm"
        type="button"
        variant="destructive-outline"
      >
        <AppIcons.trash data-icon="inline-start" />
        {t("media.deleteSelected")}
      </Button>
    </div>
  );

  const deleteTargets = deleteTarget ? [deleteTarget] : bulkDeleteTargets;
  const isBulkDelete = !deleteTarget && bulkDeleteTargets.length > 0;

  return (
    <>
      {/*
        Shared card + toolbar so ListViewToggle is NOT remounted when switching
        Grid/List (remount made the thumb always animate left→right from 0).
      */}
      <div className="mb-4 flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)] lg:mb-6">
        <div className="shrink-0 border-b border-border/80 bg-muted/15 p-3">{toolbar}</div>

        {view === "list" ? (
          <DataTable
            bulkActions={bulkActions}
            columns={columns}
            data={filtered}
            embedded
            emptyIcon={<AppIcons.image className="size-5" aria-hidden />}
            emptyMessage={
              isFiltered ? t("media.filteredEmptyDescription") : t("media.libraryEmptyDescription")
            }
            emptyTitle={isFiltered ? t("media.filteredEmpty") : t("media.libraryEmpty")}
            filteredEmptyMessage={t("media.filteredEmptyDescription")}
            filteredEmptyTitle={t("media.filteredEmpty")}
            footer={footer}
            getRowId={(asset) => asset.id}
            isFiltered={isFiltered}
            isLoading={pending}
            selectedSummaryLabel={t("media.selectedSummary")}
            skeletonShowMedia
          />
        ) : pending ? (
          <MediaGridSkeleton />
        ) : filtered.length ? (
          <>
            <div className="flex items-center gap-3 border-b border-border/80 bg-[var(--table-sticky-header)] px-4 py-2.5">
              <Checkbox
                aria-label={t("media.selectAll")}
                checked={
                  allPageSelected
                    ? true
                    : selectedAssets.length > 0
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={(checked) => toggleSelectPage(checked === true)}
              />
              <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
                {selectedAssets.length > 0
                  ? t("media.selectionStatus", { count: selectedAssets.length })
                  : t("media.selectAll")}
              </span>
              {selectedAssets.length > 0 ? (
                <Button
                  className="shrink-0"
                  onClick={() => setSelectedIds(new Set())}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {t("common.clearSelection")}
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-3.5 sm:p-4 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((asset) => {
                const selected = selectedIds.has(asset.id);
                return (
                  <article
                    className={cn(
                      "group relative overflow-hidden rounded-xl border border-border/80 bg-card transition-[box-shadow,border-color] duration-200 ease-out",
                      selected
                        ? "border-primary/40 shadow-sm ring-2 ring-primary/20"
                        : "hover:border-border hover:shadow-sm",
                    )}
                    key={asset.id}
                  >
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        aria-label={t("media.selectAsset", { name: asset.displayName })}
                        checked={selected}
                        className="border-background bg-background/90 shadow-sm"
                        onCheckedChange={(checked) =>
                          toggleSelected(asset.id, checked === true)
                        }
                        onClick={(event) => event.stopPropagation()}
                      />
                    </div>
                    <span className="pointer-events-none absolute top-2 right-2 z-10 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white uppercase backdrop-blur-sm">
                      {formatMimeLabel(asset.mimeType)}
                    </span>
                    <button
                      className="relative block w-full bg-muted text-left"
                      onClick={() => openLightbox(asset)}
                      type="button"
                    >
                      {/* biome-ignore lint/performance/noImgElement: Runtime object-storage media. */}
                      <img
                        alt={asset.altText ?? ""}
                        className="aspect-[4/3] w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.015]"
                        src={asset.publicUrl ?? ""}
                      />
                      <span className="pointer-events-none absolute inset-0 flex items-end justify-end bg-linear-to-t from-black/40 via-transparent to-transparent p-2 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
                        <span className="rounded-full border border-white/20 bg-black/45 p-1.5 text-white">
                          <AppIcons.expand className="size-3.5" />
                        </span>
                      </span>
                    </button>
                    <div className="flex min-w-0 items-center gap-2 border-t border-border/70 bg-muted/10 p-3">
                      <AssetName asset={asset} onOpen={() => setEditing(asset)} />
                      <div className="shrink-0">
                        <RowActionsMenu
                          actions={assetActions(asset)}
                          label={t("media.rowActions")}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <DataTableBulkBar
              actions={bulkActions(selectedAssets)}
              onClearSelection={() => setSelectedIds(new Set())}
              selectedCount={selectedAssets.length}
              summaryLabel={t("media.selectedSummary")}
            />
            {footer ? (
              <div className="shrink-0 border-t border-border/80 bg-muted/10 px-3 py-2">{footer}</div>
            ) : null}
          </>
        ) : (
          <>
            {/* Match DataTable empty: flat icon + title + description, no extra CTA */}
            <div className="flex min-h-52 items-center justify-center px-6 py-12 sm:min-h-60">
              <Empty className="max-w-sm gap-3 border-0 bg-transparent p-0">
                <EmptyHeader className="gap-2.5">
                  <span className="text-muted-foreground/80">
                    <AppIcons.image className="size-5" aria-hidden />
                  </span>
                  <EmptyTitle className="font-medium">
                    {isFiltered ? t("media.filteredEmpty") : t("media.libraryEmpty")}
                  </EmptyTitle>
                  <EmptyDescription className="text-sm leading-relaxed">
                    {isFiltered
                      ? t("media.filteredEmptyDescription")
                      : t("media.libraryEmptyDescription")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
            <DataTableBulkBar
              actions={bulkActions(selectedAssets)}
              onClearSelection={() => setSelectedIds(new Set())}
              selectedCount={selectedAssets.length}
              summaryLabel={t("media.selectedSummary")}
            />
          </>
        )}
      </div>

      <MediaEditSheet
        asset={editing}
        onClose={() => setEditing(null)}
        onOpenLightbox={() => {
          if (editing) openLightbox(editing);
        }}
        onSaved={() => {
          setEditing(null);
          onChanged();
        }}
      />

      <MediaLightbox
        assets={filtered}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setBulkDeleteTargets([]);
          }
        }}
        open={Boolean(deleteTarget) || isBulkDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBulkDelete
                ? t("media.deleteSelectedConfirm", { count: deleteTargets.length })
                : t("media.deleteConfirm")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBulkDelete
                ? t("media.deleteSelectedDescription")
                : t("media.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteTargets.length}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete(deleteTargets);
              }}
              variant="destructive"
            >
              {t("media.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AssetName({ asset, onOpen }: { asset: MediaAsset; onOpen?: () => void }) {
  const dimensions = mediaAssetDimensionsLabel(asset);
  return (
    <div className="min-w-0 flex-1 overflow-hidden">
      {onOpen ? (
        <button
          className="block w-full min-w-0 truncate text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
          onClick={onOpen}
          title={asset.displayName}
          type="button"
        >
          {asset.displayName}
        </button>
      ) : (
        <p className="truncate text-sm font-medium" title={asset.displayName}>
          {asset.displayName}
        </p>
      )}
      <p className="truncate text-xs text-muted-foreground tabular-nums">
        {dimensions ? `${dimensions} · ` : ""}
        {formatBytes(asset.byteSize)}
      </p>
    </div>
  );
}

/** Layout-faithful grid loading stand-in (mirrors cards, not list rows). */
function MediaGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-w-0 flex-col"
      role="status"
    >
      <div className="flex items-center gap-3 border-b border-border/80 bg-[var(--table-sticky-header)] px-4 py-2.5">
        <Skeleton className="size-4 shrink-0 rounded-[4px]" />
        <Skeleton className="h-2.5 w-20 shrink-0" />
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-3.5 sm:p-4 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <div
            className="overflow-hidden rounded-xl border border-border/80 bg-card"
            key={`media-skel-${i}`}
          >
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="flex items-center gap-2 border-t border-border/70 bg-muted/10 p-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton
                  className={cn(
                    "h-3.5 max-w-full",
                    i % 3 === 0 ? "w-[70%]" : i % 3 === 1 ? "w-[85%]" : "w-[60%]",
                  )}
                />
                <Skeleton className="h-2.5 w-16" />
              </div>
              <Skeleton className="size-7 shrink-0 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
