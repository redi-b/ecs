"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { DataTableFilters } from "@/components/app/data-table-filters";
import { AppIcons } from "@/components/app/icons";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/provider";
import type { MediaAsset } from "@/lib/merchant-media";
import { cn } from "@/lib/utils";
import {
  type MediaFilterValues,
  MediaSortControl,
  mediaFilterDefinitions,
} from "./media-filter-controls";
import type { MediaSort } from "./media-helpers";
import { formatBytes, formatMimeLabel, mediaAssetDimensionsLabel } from "./media-helpers";
import { MediaLightbox } from "./media-lightbox";
import { fetchMediaPickerPage, toggleMediaSelection } from "./media-picker-query";

export type MediaLibrarySelectionMode = "single" | "multiple";

type MediaLibraryDialogProps = {
  /** Defaults to single-select. Use multiple for product media and other batch picks. */
  selectionMode?: MediaLibrarySelectionMode;
  /** Called with one asset (single) or many (multiple). Always receives selected assets. */
  onSelect: (assets: MediaAsset[]) => void;
  /** Optional hard cap for multi-select. */
  maxSelection?: number | undefined;
  triggerClassName?: string | undefined;
  triggerLabel?: string | undefined;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | undefined;
  triggerSize?: "default" | "sm" | "xs" | "lg" | undefined;
  triggerContent?: ReactNode;
  /** Controls the dialog externally when the trigger lives in another overlay. */
  open?: boolean | undefined;
  /** Hide the built-in trigger when another component owns the opening action. */
  showTrigger?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
};

export function MediaLibraryDialog({
  selectionMode = "single",
  onSelect,
  maxSelection,
  triggerClassName,
  triggerLabel,
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerContent,
  open: controlledOpen,
  showTrigger = true,
  onOpenChange,
}: MediaLibraryDialogProps) {
  const { t } = useI18n();
  const isMultiple = selectionMode === "multiple";
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<MediaFilterValues>({
    mimeType: "all",
    orientation: "all",
    size: "all",
  });
  const [sort, setSort] = useState<MediaSort>("newest");
  const [page, setPage] = useState(0);
  const [selectedAssets, setSelectedAssets] = useState<MediaAsset[]>([]);
  const selectedIds = selectedAssets.map((asset) => asset.id);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  function setDialogOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  const params = new URLSearchParams({
    limit: "24",
    offset: String(page * 24),
    sort,
    publicOnly: "true",
  });
  if (query) params.set("q", query);
  params.set("mimeType", values.mimeType === "all" ? "image/" : values.mimeType);
  if (values.orientation !== "all") params.set("orientation", values.orientation);
  if (values.size !== "all") params.set("size", values.size);
  const mediaQuery = useQuery({
    queryKey: ["media-picker", params.toString()],
    enabled: open,
    queryFn: ({ signal }) => fetchMediaPickerPage(params, signal),
    retry: 1,
  });
  const loading = mediaQuery.isPending;
  const loadError = mediaQuery.isError;
  const readyAssets = mediaQuery.data?.assets ?? [];
  const count = mediaQuery.data?.count ?? 0;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setValues({ mimeType: "all", orientation: "all", size: "all" });
      setSort("newest");
      setPage(0);
      setSelectedAssets([]);
      setLightboxIndex(null);
    }
  }, [open]);

  function changeFilters(next: Partial<MediaFilterValues>) {
    setValues((current) => ({ ...current, ...next }));
    setPage(0);
    setLightboxIndex(null);
  }
  const filters = mediaFilterDefinitions(t, values, changeFilters);

  function toggleSelected(asset: MediaAsset) {
    setSelectedAssets((current) => toggleMediaSelection(current, asset, isMultiple, maxSelection));
  }

  function confirmSelection(assetsToUse: MediaAsset[]) {
    if (!assetsToUse.length) return;
    onSelect(isMultiple ? assetsToUse.slice(0, maxSelection) : assetsToUse.slice(0, 1));
    setDialogOpen(false);
  }

  const allVisibleSelected =
    readyAssets.length > 0 && readyAssets.every((asset) => selectedIds.includes(asset.id));

  return (
    <>
      {showTrigger ? (
        <Button
          className={triggerClassName}
          onClick={() => setDialogOpen(true)}
          size={triggerSize}
          type="button"
          variant={triggerVariant}
        >
          {triggerContent ?? (
            <>
              <AppIcons.image data-icon="inline-start" />
              {triggerLabel ?? t("media.chooseLibrary")}
            </>
          )}
        </Button>
      ) : null}
      <Dialog onOpenChange={setDialogOpen} open={open}>
        <DialogContent
          className="z-[80] flex max-h-[min(90vh,48rem)] w-full flex-col gap-0 overflow-visible p-0 sm:max-w-4xl"
          overlayClassName="z-[75]"
        >
          <DialogHeader className="shrink-0 gap-1.5 border-b px-4 py-4 text-left sm:px-5">
            <DialogTitle>{t("media.chooseLibrary")}</DialogTitle>
            <DialogDescription className="sr-only">
              {isMultiple
                ? t("media.chooseLibraryDescriptionMultiple")
                : t("media.chooseLibraryDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-5">
            <DataTableFilters
              actions={
                <MediaSortControl
                  value={sort}
                  onChange={(value) => {
                    setSort(value);
                    setPage(0);
                    setLightboxIndex(null);
                  }}
                />
              }
              filters={filters}
              onClearAll={() => {
                setQuery("");
                changeFilters({ mimeType: "all", orientation: "all", size: "all" });
              }}
            >
              <ListToolbarSearch
                clearLabel={t("common.clearSearch")}
                label={t("media.search")}
                onChange={(value) => {
                  setQuery(value);
                  setPage(0);
                  setLightboxIndex(null);
                }}
                placeholder={t("media.searchPlaceholder")}
                value={query}
              />
            </DataTableFilters>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {loading
                  ? t("media.pickerLoading")
                  : t("media.pageCountSummary", { pageCount: readyAssets.length, total: count })}
              </p>
              {isMultiple && readyAssets.length > 0 ? (
                <Button
                  onClick={() => {
                    if (allVisibleSelected) {
                      setSelectedAssets((current) =>
                        current.filter(
                          (asset) => !readyAssets.some((visible) => visible.id === asset.id),
                        ),
                      );
                      return;
                    }
                    setSelectedAssets((current) =>
                      readyAssets.reduce(
                        (selected, asset) =>
                          selected.some((item) => item.id === asset.id)
                            ? selected
                            : toggleMediaSelection(selected, asset, true, maxSelection),
                        current,
                      ),
                    );
                  }}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  {allVisibleSelected ? t("media.clearSelection") : t("media.selectPage")}
                </Button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border bg-card/60">
              {loading ? (
                <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4">
                  {Array.from({ length: 8 }, (_, index) => `media-skeleton-${index + 1}`).map(
                    (key) => (
                      <div className="overflow-hidden rounded-xl border" key={key}>
                        <Skeleton className="aspect-[4/3] w-full rounded-none" />
                        <div className="space-y-2 border-t p-3">
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : loadError ? (
                <Empty className="min-h-64 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <AppIcons.error />
                    </EmptyMedia>
                    <EmptyTitle>{t("media.libraryLoadError")}</EmptyTitle>
                    <EmptyDescription>{t("media.libraryLoadErrorDescription")}</EmptyDescription>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void mediaQuery.refetch()}
                    >
                      {t("media.retry")}
                    </Button>
                  </EmptyHeader>
                </Empty>
              ) : readyAssets.length ? (
                <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4">
                  {readyAssets.map((asset, index) => {
                    const isSelected = selectedIds.includes(asset.id);
                    const dimensions = mediaAssetDimensionsLabel(asset);
                    return (
                      <article
                        className={cn(
                          "group relative overflow-hidden rounded-xl border bg-card text-left transition-colors duration-200 ease-out",
                          isSelected
                            ? "border-primary/50 ring-2 ring-primary/20"
                            : "hover:border-foreground/25",
                        )}
                        key={asset.id}
                      >
                        <button
                          className="relative block w-full bg-muted text-left"
                          aria-pressed={isSelected}
                          aria-label={asset.displayName}
                          onClick={() => toggleSelected(asset)}
                          onDoubleClick={() => {
                            if (isMultiple) {
                              const next = selectedAssets.some((item) => item.id === asset.id)
                                ? selectedAssets
                                : [...selectedAssets, asset];
                              confirmSelection(next);
                              return;
                            }
                            confirmSelection([asset]);
                          }}
                          type="button"
                        >
                          {/* biome-ignore lint/performance/noImgElement: Runtime object-storage asset. */}
                          <img
                            alt={asset.altText ?? ""}
                            className="aspect-[4/3] w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.01]"
                            src={asset.publicUrl ?? ""}
                          />
                          <span
                            className={cn(
                              "absolute top-2 left-2 grid size-6 place-items-center rounded-full border shadow-sm transition-colors",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-background/80 bg-background/90 text-muted-foreground",
                            )}
                          >
                            {isSelected ? (
                              <AppIcons.check className="size-3.5" />
                            ) : (
                              <span className="size-2 rounded-full bg-transparent" />
                            )}
                          </span>
                        </button>
                        <div className="flex items-start gap-1 border-t p-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{asset.displayName}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {formatMimeLabel(asset.mimeType)}
                              {dimensions ? ` · ${dimensions}` : ""}
                              {` · ${formatBytes(asset.byteSize)}`}
                            </p>
                          </div>
                          <Button
                            aria-label={t("media.openImage")}
                            className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
                            onClick={() => setLightboxIndex(index)}
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                          >
                            <AppIcons.expand />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Empty className="min-h-64 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <AppIcons.image />
                    </EmptyMedia>
                    <EmptyTitle>
                      {query ||
                      values.mimeType !== "all" ||
                      values.orientation !== "all" ||
                      values.size !== "all"
                        ? t("media.filteredEmpty")
                        : t("media.libraryEmpty")}
                    </EmptyTitle>
                    <EmptyDescription>
                      {query ||
                      values.mimeType !== "all" ||
                      values.orientation !== "all" ||
                      values.size !== "all"
                        ? t("media.filteredEmptyDescription")
                        : t("media.pickerEmptyDescription")}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={loading || page === 0}
                onClick={() => {
                  setPage((current) => Math.max(0, current - 1));
                  setLightboxIndex(null);
                }}
              >
                {t("common.pagination.previous")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("common.pagination.pageOf", {
                  current: page + 1,
                  total: Math.max(1, Math.ceil(count / 24)),
                })}
              </span>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={loading || (page + 1) * 24 >= count}
                onClick={() => {
                  setPage((current) => current + 1);
                  setLightboxIndex(null);
                }}
              >
                {t("common.pagination.next")}
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4",
              "sm:flex-row sm:items-center sm:justify-between",
            )}
            data-slot="dialog-footer"
          >
            <div className="min-w-0 text-center sm:text-left">
              {selectedAssets.length ? (
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <Badge variant="secondary">
                    {isMultiple
                      ? t("media.pickerSelectedCount", { count: selectedAssets.length })
                      : t("media.pickerSelected")}
                  </Badge>
                  <p className="truncate text-xs text-muted-foreground">
                    {isMultiple
                      ? selectedAssets.map((asset) => asset.displayName).join(", ")
                      : selectedAssets[0]?.displayName}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {isMultiple ? t("media.pickerSelectHintMultiple") : t("media.pickerSelectHint")}
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button onClick={() => setDialogOpen(false)} type="button" variant="outline">
                {t("common.cancel")}
              </Button>
              <Button
                disabled={!selectedAssets.length}
                onClick={() => confirmSelection(selectedAssets)}
                type="button"
              >
                <AppIcons.check data-icon="inline-start" />
                {isMultiple
                  ? t("media.useSelectedCount", { count: selectedAssets.length })
                  : t("media.useSelected")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MediaLightbox
        assets={readyAssets}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </>
  );
}
