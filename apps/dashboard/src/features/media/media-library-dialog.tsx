"use client";

import { useEffect, useMemo, useState } from "react";

import {
  type DataTableFilterDefinition,
  DataTableFilters,
} from "@/components/app/data-table-filters";
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
  filterAndSortMediaAssets,
  formatBytes,
  formatMimeLabel,
  mediaAssetDimensionsLabel,
} from "./media-helpers";
import { MediaLightbox } from "./media-lightbox";

export type MediaLibrarySelectionMode = "single" | "multiple";

type MediaLibraryDialogProps = {
  /** Defaults to single-select. Use multiple for product media and other batch picks. */
  selectionMode?: MediaLibrarySelectionMode;
  /** Called with one asset (single) or many (multiple). Always receives selected assets. */
  onSelect: (assets: MediaAsset[]) => void;
  /** Optional hard cap for multi-select. */
  maxSelection?: number | undefined;
  triggerLabel?: string | undefined;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | undefined;
  triggerSize?: "default" | "sm" | "xs" | "lg" | undefined;
};

export function MediaLibraryDialog({
  selectionMode = "single",
  onSelect,
  maxSelection,
  triggerLabel,
  triggerVariant = "outline",
  triggerSize = "sm",
}: MediaLibraryDialogProps) {
  const { t } = useI18n();
  const isMultiple = selectionMode === "multiple";
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams({ limit: "100", offset: "0" });
    if (query.trim()) params.set("q", query.trim());
    if (type !== "all") params.set("mimeType", type);
    void fetch(`/admin/media/assets?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { assets?: MediaAsset[] } | null;
        if (!response.ok) throw new Error("load_failed");
        setAssets(data?.assets ?? []);
        setLoadError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
        setAssets([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, query, type]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setType("all");
      setSelectedIds([]);
      setLightboxIndex(null);
    }
  }, [open]);

  const readyAssets = useMemo(
    () =>
      filterAndSortMediaAssets(assets, {
        orientation: "all",
        query: "",
        size: "all",
        sort: "newest",
        type: "all",
      }).filter((asset) => Boolean(asset.publicUrl)),
    [assets],
  );

  const selectedAssets = useMemo(
    () =>
      selectedIds
        .map((id) => readyAssets.find((asset) => asset.id === id))
        .filter((asset): asset is MediaAsset => Boolean(asset)),
    [readyAssets, selectedIds],
  );

  const filters: DataTableFilterDefinition[] = [
    {
      defaultValue: "all",
      id: "type",
      label: t("media.type"),
      onChange: setType,
      options: [
        { label: t("media.allTypes"), value: "all" },
        { label: "JPEG", value: "image/jpeg" },
        { label: "PNG", value: "image/png" },
        { label: "WebP", value: "image/webp" },
        { label: "AVIF", value: "image/avif" },
        { label: "GIF", value: "image/gif" },
      ],
      value: type,
    },
  ];

  function toggleSelected(assetId: string) {
    setSelectedIds((current) => {
      if (isMultiple) {
        if (current.includes(assetId)) return current.filter((id) => id !== assetId);
        if (maxSelection && current.length >= maxSelection) return current;
        return [...current, assetId];
      }
      return current[0] === assetId ? [] : [assetId];
    });
  }

  function confirmSelection(assetsToUse: MediaAsset[]) {
    if (!assetsToUse.length) return;
    onSelect(isMultiple ? assetsToUse : assetsToUse.slice(0, 1));
    setOpen(false);
  }

  const allVisibleSelected =
    readyAssets.length > 0 && readyAssets.every((asset) => selectedIds.includes(asset.id));

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size={triggerSize}
        type="button"
        variant={triggerVariant}
      >
        <AppIcons.image data-icon="inline-start" />
        {triggerLabel ?? t("media.chooseLibrary")}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="flex max-h-[min(90vh,48rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 gap-1.5 border-b px-4 py-4 text-left sm:px-5">
            <DialogTitle>{t("media.chooseLibrary")}</DialogTitle>
            <DialogDescription>
              {isMultiple
                ? t("media.chooseLibraryDescriptionMultiple")
                : t("media.chooseLibraryDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-5">
            <DataTableFilters
              filters={filters}
              onClearAll={() => {
                setQuery("");
                setType("all");
              }}
            >
              <ListToolbarSearch
                clearLabel={t("media.clearFilters")}
                label={t("media.search")}
                onChange={setQuery}
                placeholder={t("media.searchPlaceholder")}
                value={query}
              />
            </DataTableFilters>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {loading
                  ? t("media.pickerLoading")
                  : t("media.pickerCount", { count: readyAssets.length })}
              </p>
              {isMultiple && readyAssets.length > 0 ? (
                <Button
                  onClick={() => {
                    if (allVisibleSelected) {
                      setSelectedIds([]);
                      return;
                    }
                    const next = readyAssets.map((asset) => asset.id);
                    setSelectedIds(
                      maxSelection ? next.slice(0, maxSelection) : next,
                    );
                  }}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  {allVisibleSelected ? t("media.clearSelection") : t("media.selectAll")}
                </Button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border bg-card/60">
              {loading ? (
                <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div className="overflow-hidden rounded-xl border" key={index}>
                      <Skeleton className="aspect-[4/3] w-full rounded-none" />
                      <div className="space-y-2 border-t p-3">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : loadError ? (
                <Empty className="min-h-64 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <AppIcons.error />
                    </EmptyMedia>
                    <EmptyTitle>{t("media.libraryLoadError")}</EmptyTitle>
                    <EmptyDescription>{t("media.libraryLoadErrorDescription")}</EmptyDescription>
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
                          onClick={() => toggleSelected(asset.id)}
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
                      {query || type !== "all"
                        ? t("media.filteredEmpty")
                        : t("media.libraryEmpty")}
                    </EmptyTitle>
                    <EmptyDescription>
                      {query || type !== "all"
                        ? t("media.filteredEmptyDescription")
                        : t("media.pickerEmptyDescription")}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/50 p-4",
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
                  {isMultiple
                    ? t("media.pickerSelectHintMultiple")
                    : t("media.pickerSelectHint")}
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button onClick={() => setOpen(false)} type="button" variant="outline">
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
