"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "@/components/app/link";
import { AppIcons } from "@/components/app/icons";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export type ProductCatalogPickItem = {
  /** Selection id (product id or variant id depending on caller). */
  id: string;
  title: string;
  /** Secondary line (SKU, handle, option name). */
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  /** Free-text haystack for local search. */
  searchText: string;
  /** Optional price label shown on the card. */
  meta?: string | null;
};

type ProductCatalogPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ProductCatalogPickItem[];
  loading?: boolean;
  /** Pre-selected ids when the dialog opens. */
  selectedIds?: string[];
  selectionMode?: "single" | "multiple";
  maxSelection?: number;
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  confirmLabel?: string;
  onConfirm: (ids: string[]) => void;
  /** Show link to create product in empty state. */
  showCreateProductLink?: boolean;
};

/**
 * Media-library-style product/variant picker: search, multi-select, confirm.
 * Callers supply a flat item list (products or variants).
 */
export function ProductCatalogPickerDialog({
  open,
  onOpenChange,
  items,
  loading = false,
  selectedIds: selectedIdsProp = [],
  selectionMode = "multiple",
  maxSelection,
  title,
  description,
  searchPlaceholder,
  emptyTitle,
  emptyDescription,
  confirmLabel,
  onConfirm,
  showCreateProductLink = true,
}: ProductCatalogPickerDialogProps) {
  const { t } = useI18n();
  const isMultiple = selectionMode === "multiple";
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedIdsProp);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    setSelectedIds(selectedIdsProp);
  }, [open, selectedIdsProp]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.searchText.toLowerCase().includes(needle));
  }, [items, query]);

  function toggle(id: string) {
    setSelectedIds((current) => {
      if (!isMultiple) {
        return current[0] === id ? [] : [id];
      }
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (maxSelection && current.length >= maxSelection) return current;
      return [...current, id];
    });
  }

  function confirm() {
    if (!selectedIds.length) return;
    onConfirm(selectedIds);
    onOpenChange(false);
  }

  const resolvedTitle = title ?? t("common.selectProducts");
  const resolvedDescription =
    description ??
    (isMultiple
      ? t("products.catalogPicker.descriptionMultiple")
      : t("products.catalogPicker.descriptionSingle"));

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id));

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="z-[70] flex max-h-[min(90vh,48rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        overlayClassName="z-[70]"
      >
        <DialogHeader className="shrink-0 gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-5">
          <ListToolbarSearch
            clearLabel={t("common.clearSearch")}
            label={t("common.search")}
            onChange={setQuery}
            placeholder={searchPlaceholder ?? t("common.searchProducts")}
            value={query}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {loading
                ? t("common.loadingProducts")
                : t("products.catalogPicker.count", { count: filtered.length })}
            </p>
            {isMultiple && filtered.length > 0 ? (
              <Button
                onClick={() => {
                  if (allVisibleSelected) {
                    setSelectedIds((current) =>
                      current.filter((id) => !filtered.some((item) => item.id === id)),
                    );
                    return;
                  }
                  const next = filtered.map((item) => item.id);
                  setSelectedIds((current) => {
                    const merged = [...new Set([...current, ...next])];
                    return maxSelection ? merged.slice(0, maxSelection) : merged;
                  });
                }}
                size="xs"
                type="button"
                variant="ghost"
              >
                {allVisibleSelected ? t("common.clearSelection") : t("media.selectAll")}
              </Button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border bg-card/60">
            {loading ? (
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="flex items-center gap-3 rounded-xl border p-3" key={index}>
                    <Skeleton className="size-12 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Empty className="min-h-64 border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <AppIcons.products />
                  </EmptyMedia>
                  <EmptyTitle>
                    {items.length === 0
                      ? (emptyTitle ?? t("products.catalogPicker.emptyTitle"))
                      : t("common.noMatchingProducts")}
                  </EmptyTitle>
                  <EmptyDescription>
                    {items.length === 0
                      ? (emptyDescription ?? t("products.catalogPicker.emptyDescription"))
                      : t("products.catalogPicker.tryDifferentSearch")}
                  </EmptyDescription>
                  {showCreateProductLink && items.length === 0 ? (
                    <Link
                      className="mt-2 text-sm font-medium text-primary hover:underline"
                      href={`${dashboardRoutes.products}?create=product`}
                      prefetch={false}
                    >
                      {t("commandCenter.actions.createProduct")}
                    </Link>
                  ) : null}
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                {filtered.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
                          isSelected
                            ? "border-primary/50 bg-primary/5 ring-2 ring-primary/15"
                            : "hover:border-foreground/25 hover:bg-muted/30",
                        )}
                        onClick={() => toggle(item.id)}
                        type="button"
                      >
                        <span
                          className={cn(
                            "grid size-5 shrink-0 place-items-center rounded-md border",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background",
                          )}
                        >
                          {isSelected ? <AppIcons.check className="size-3.5" /> : null}
                        </span>
                        <ProductPickThumb title={item.title} url={item.thumbnailUrl} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.title}</span>
                          {item.subtitle ? (
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          ) : null}
                        </span>
                        {item.meta ? (
                          <Badge className="shrink-0 rounded-full" variant="outline">
                            {item.meta}
                          </Badge>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t bg-muted/40 p-4 sm:justify-between">
          <p className="self-center text-sm text-muted-foreground">
            {selectedIds.length === 0
              ? t("products.catalogPicker.noneSelected")
              : selectedIds.length === 1
                ? t("common.productSelected")
                : t("common.productsSelected", { count: selectedIds.length })}
          </p>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              {t("common.cancel")}
            </Button>
            <Button disabled={selectedIds.length === 0} onClick={confirm} type="button">
              {confirmLabel ?? t("products.catalogPicker.addSelected")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductPickThumb({ title, url }: { title: string; url?: string | null }) {
  if (url) {
    return (
      // biome-ignore lint/performance/noImgElement: product thumbnail from commerce CDN
      <img
        alt=""
        className="size-12 shrink-0 rounded-xl border object-cover"
        src={url}
      />
    );
  }
  const initial = title.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-xl border bg-muted text-sm font-semibold text-muted-foreground">
      {initial}
    </span>
  );
}

/** Compact trigger button that opens the catalog picker. */
export function ProductCatalogPickerTrigger({
  disabled,
  label,
  loading,
  onClick,
  selectedCount = 0,
}: {
  disabled?: boolean;
  label?: string;
  loading?: boolean;
  onClick: () => void;
  selectedCount?: number;
}) {
  const { t } = useI18n();
  const resolved =
    label ??
    (selectedCount === 0
      ? loading
        ? t("common.loadingProducts")
        : t("common.selectProducts")
      : selectedCount === 1
        ? t("common.productSelected")
        : t("common.productsSelected", { count: selectedCount }));

  return (
    <Button
      className={cn(
        "h-9 w-full justify-between px-3 font-normal shadow-none",
        selectedCount === 0 && "text-muted-foreground",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      <span className="flex min-w-0 items-center gap-2 truncate">
        <AppIcons.products className="size-4 shrink-0 opacity-70" />
        <span className="truncate">{resolved}</span>
      </span>
      <AppIcons.arrowRight className="size-4 shrink-0 opacity-60" />
    </Button>
  );
}
