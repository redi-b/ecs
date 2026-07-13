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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
        <span className="text-muted-foreground">{formatMimeLabel(row.original.mimeType)}</span>
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
        variant="destructive"
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
      {view === "list" ? (
        <DataTable
          bulkActions={bulkActions}
          columns={columns}
          data={filtered}
          emptyMessage={
            isFiltered ? t("media.filteredEmptyDescription") : t("media.libraryEmptyDescription")
          }
          emptyTitle={isFiltered ? t("media.filteredEmpty") : t("media.libraryEmpty")}
          filteredEmptyMessage={t("media.filteredEmptyDescription")}
          filteredEmptyTitle={t("media.filteredEmpty")}
          footer={footer}
          getRowId={(asset) => asset.id}
          isFiltered={isFiltered}
          selectedSummaryLabel={t("media.selectedSummary")}
          toolbar={toolbar}
        />
      ) : (
        <div className="mb-4 flex w-full min-w-0 flex-col overflow-hidden rounded-[1.35rem] border bg-card/95 lg:mb-6">
          <div className="border-b bg-muted/20 p-3">{toolbar}</div>

          {filtered.length ? (
            <>
              <div className="flex items-center gap-3 border-b px-4 py-2.5">
                <Checkbox
                  aria-label={t("media.selectAll")}
                  checked={allPageSelected}
                  onCheckedChange={(checked) => toggleSelectPage(checked === true)}
                />
                <span className="text-xs text-muted-foreground">{t("media.selectAll")}</span>
              </div>

              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((asset) => {
                  const selected = selectedIds.has(asset.id);
                  return (
                    <article
                      className={cn(
                        "group relative overflow-hidden rounded-xl border bg-card transition-colors duration-200 ease-out",
                        selected
                          ? "border-primary/50 ring-2 ring-primary/20"
                          : "hover:border-foreground/20",
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
                      <button
                        className="relative block w-full bg-muted text-left"
                        onClick={() => openLightbox(asset)}
                        type="button"
                      >
                        {/* biome-ignore lint/performance/noImgElement: Runtime object-storage media. */}
                        <img
                          alt={asset.altText ?? ""}
                          className="aspect-[4/3] w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.01]"
                          src={asset.publicUrl ?? ""}
                        />
                        <span className="pointer-events-none absolute inset-0 flex items-end justify-end bg-linear-to-t from-black/35 via-transparent to-transparent p-2 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
                          <span className="rounded-full border border-white/20 bg-black/45 p-1.5 text-white">
                            <AppIcons.expand className="size-3.5" />
                          </span>
                        </span>
                      </button>
                      <div className="flex items-center gap-2 border-t p-3">
                        <AssetName asset={asset} onOpen={() => setEditing(asset)} />
                        <RowActionsMenu
                          actions={assetActions(asset)}
                          label={t("media.rowActions")}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="p-4">
              <Empty className="min-h-72 border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <AppIcons.image />
                  </EmptyMedia>
                  <EmptyTitle>
                    {isFiltered ? t("media.filteredEmpty") : t("media.libraryEmpty")}
                  </EmptyTitle>
                  <EmptyDescription>
                    {isFiltered
                      ? t("media.filteredEmptyDescription")
                      : t("media.libraryEmptyDescription")}
                  </EmptyDescription>
                </EmptyHeader>
                {isFiltered ? (
                  <Button onClick={clearFilters} size="sm" type="button" variant="outline">
                    {t("media.clearFilters")}
                  </Button>
                ) : null}
              </Empty>
            </div>
          )}

          <DataTableBulkBar
            actions={bulkActions(selectedAssets)}
            onClearSelection={() => setSelectedIds(new Set())}
            selectedCount={selectedAssets.length}
            summaryLabel={t("media.selectedSummary")}
          />
          {footer ? <div className="border-t bg-muted/10 px-3 py-2">{footer}</div> : null}
        </div>
      )}

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
    <div className="min-w-0 flex-1">
      {onOpen ? (
        <button
          className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
          onClick={onOpen}
          type="button"
        >
          {asset.displayName}
        </button>
      ) : (
        <p className="truncate text-sm font-medium">{asset.displayName}</p>
      )}
      <p className="truncate text-xs text-muted-foreground">
        {dimensions ? `${dimensions} · ` : ""}
        {formatBytes(asset.byteSize)}
      </p>
    </div>
  );
}
