"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "@/components/app/link";
import { AppIcons } from "@/components/app/icons";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

/** Flat pick item (product-level selection: collections, promotions). */
export type ProductCatalogPickItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  searchText: string;
  meta?: string | null;
};

/** Variant under a product (order lines, stocked options). */
export type ProductCatalogPickVariant = {
  id: string;
  title: string;
  sku?: string | null;
  priceLabel?: string | null;
};

/** Product row with optional variants for product-first browsing. */
export type ProductCatalogPickProduct = {
  id: string;
  title: string;
  handle?: string | null;
  thumbnailUrl?: string | null;
  searchText: string;
  variants?: ProductCatalogPickVariant[];
};

const PAGE_SIZE = 24;

type ProductCatalogPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Flat product list for product-id selection (collections / promotions).
   * Ignored when `products` is provided.
   */
  items?: ProductCatalogPickItem[];
  /**
   * Product-first catalog. When variants exist, selection targets variant ids;
   * otherwise product ids.
   */
  products?: ProductCatalogPickProduct[];
  /** What `onConfirm` ids refer to. Default inferred from products vs items. */
  selectionTarget?: "product" | "variant";
  loading?: boolean;
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
  showCreateProductLink?: boolean;
  /**
   * Optional server-side page load. When provided, “Load more” calls this
   * instead of only slicing the client list.
   */
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
};

/**
 * Media-library-style catalog picker.
 * - Product mode: multi-select product cards with thumbnails.
 * - Variant mode: product cards expand to choose options (avoids flooding the list).
 */
export function ProductCatalogPickerDialog({
  open,
  onOpenChange,
  items = [],
  products,
  selectionTarget: selectionTargetProp,
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
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}: ProductCatalogPickerDialogProps) {
  const { t } = useI18n();
  const isMultiple = selectionMode === "multiple";
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedIdsProp);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  const catalogProducts = useMemo(() => {
    if (products?.length) return products;
    return items.map(
      (item): ProductCatalogPickProduct => ({
        id: item.id,
        title: item.title,
        handle: item.subtitle?.startsWith("/") ? item.subtitle.slice(1) : null,
        thumbnailUrl: item.thumbnailUrl,
        searchText: item.searchText,
        // No variants → product-level selection.
        variants: undefined,
      }),
    );
  }, [items, products]);

  const selectionTarget: "product" | "variant" =
    selectionTargetProp ??
    (products?.some((p) => (p.variants?.length ?? 0) > 0) ? "variant" : "product");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setVisibleCount(PAGE_SIZE);
      setExpandedProductIds(new Set());
      return;
    }
    setSelectedIds(selectedIdsProp);
  }, [open, selectedIdsProp]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalogProducts;
    return catalogProducts.filter((product) => {
      if (product.searchText.toLowerCase().includes(needle)) return true;
      return (product.variants ?? []).some((variant) =>
        [variant.title, variant.sku, variant.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    });
  }, [catalogProducts, query]);

  // Auto-expand multi-option products while searching so matching options are visible.
  useEffect(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || selectionTarget !== "variant") {
      return;
    }
    setExpandedProductIds((current) => {
      const next = new Set(current);
      for (const product of filtered) {
        const variants = product.variants ?? [];
        if (variants.length <= 1) continue;
        next.add(product.id);
      }
      return next;
    });
  }, [filtered, query, selectionTarget]);

  const pageItems = filtered.slice(0, visibleCount);
  const canShowMoreClient = visibleCount < filtered.length;
  const canLoadMore = Boolean(onLoadMore && hasMore) || canShowMoreClient;

  function toggleId(id: string) {
    setSelectedIds((current) => {
      if (!isMultiple) {
        return current[0] === id ? [] : [id];
      }
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (maxSelection && current.length >= maxSelection) return current;
      return [...current, id];
    });
  }

  function toggleProductExpand(productId: string) {
    setExpandedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function productSelectedVariantCount(product: ProductCatalogPickProduct) {
    const ids = new Set((product.variants ?? []).map((v) => v.id));
    return selectedIds.filter((id) => ids.has(id)).length;
  }

  function confirm() {
    if (!selectedIds.length) return;
    onConfirm(selectedIds);
    onOpenChange(false);
  }

  function handleLoadMore() {
    if (canShowMoreClient) {
      setVisibleCount((count) => count + PAGE_SIZE);
      return;
    }
    onLoadMore?.();
  }

  const resolvedTitle = title ?? t("common.selectProducts");
  const resolvedDescription =
    description ??
    (selectionTarget === "variant"
      ? t("products.catalogPicker.descriptionVariants")
      : isMultiple
        ? t("products.catalogPicker.descriptionMultiple")
        : t("products.catalogPicker.descriptionSingle"));

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
            onChange={(value) => {
              setQuery(value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder={searchPlaceholder ?? t("common.searchProducts")}
            value={query}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {loading
                ? t("common.loadingProducts")
                : t("products.catalogPicker.count", { count: filtered.length })}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border bg-card/60">
            {loading && catalogProducts.length === 0 ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="flex items-center gap-3 rounded-xl border p-3" key={index}>
                    <Skeleton className="size-14 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
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
                    {catalogProducts.length === 0
                      ? (emptyTitle ?? t("products.catalogPicker.emptyTitle"))
                      : t("common.noMatchingProducts")}
                  </EmptyTitle>
                  <EmptyDescription>
                    {catalogProducts.length === 0
                      ? (emptyDescription ?? t("products.catalogPicker.emptyDescription"))
                      : t("products.catalogPicker.tryDifferentSearch")}
                  </EmptyDescription>
                  {showCreateProductLink && catalogProducts.length === 0 ? (
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
              <ul className="space-y-2 p-3">
                {pageItems.map((product) => {
                  const variants = product.variants ?? [];
                  const isVariantMode = selectionTarget === "variant" && variants.length > 0;
                  const singleVariant = isVariantMode && variants.length === 1;
                  const multiVariant = isVariantMode && variants.length > 1;
                  const expanded = expandedProductIds.has(product.id);

                  if (!isVariantMode) {
                    const isSelected = selectedIds.includes(product.id);
                    return (
                      <li key={product.id}>
                        <button
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
                            isSelected
                              ? "border-primary/50 bg-primary/5 ring-2 ring-primary/15"
                              : "hover:border-foreground/25 hover:bg-muted/30",
                          )}
                          onClick={() => toggleId(product.id)}
                          type="button"
                        >
                          <SelectionMark selected={isSelected} />
                          <ProductPickThumb title={product.title} url={product.thumbnailUrl} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold tracking-tight">
                              {product.title}
                            </span>
                            {product.handle ? (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                /{product.handle}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  }

                  // Single-variant product: pick the variant directly.
                  if (singleVariant) {
                    const variant = variants[0]!;
                    const isSelected = selectedIds.includes(variant.id);
                    return (
                      <li key={product.id}>
                        <button
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
                            isSelected
                              ? "border-primary/50 bg-primary/5 ring-2 ring-primary/15"
                              : "hover:border-foreground/25 hover:bg-muted/30",
                          )}
                          onClick={() => toggleId(variant.id)}
                          type="button"
                        >
                          <SelectionMark selected={isSelected} />
                          <ProductPickThumb title={product.title} url={product.thumbnailUrl} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold tracking-tight">
                              {product.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {[variant.title !== product.title ? variant.title : null, variant.sku]
                                .filter(Boolean)
                                .join(" · ") || t("products.catalogPicker.defaultOption")}
                            </span>
                          </span>
                          {variant.priceLabel ? (
                            <Badge className="shrink-0 rounded-full tabular-nums" variant="outline">
                              {variant.priceLabel}
                            </Badge>
                          ) : null}
                        </button>
                      </li>
                    );
                  }

                  // Multi-variant: expand to choose options.
                  const selectedCount = productSelectedVariantCount(product);
                  return (
                    <li className="overflow-hidden rounded-xl border bg-card" key={product.id}>
                      <button
                        className={cn(
                          "flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/30",
                          selectedCount > 0 && "bg-primary/5",
                        )}
                        onClick={() => toggleProductExpand(product.id)}
                        type="button"
                      >
                        <ProductPickThumb title={product.title} url={product.thumbnailUrl} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold tracking-tight">
                            {product.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {t("products.catalogPicker.optionCount", { count: variants.length })}
                            {selectedCount > 0
                              ? ` · ${t("products.catalogPicker.selectedOf", { selected: selectedCount, total: variants.length })}`
                              : ""}
                          </span>
                        </span>
                        <AppIcons.arrowDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            expanded && "rotate-180",
                          )}
                        />
                      </button>
                      {expanded ? (
                        <ul className="space-y-1 border-t bg-muted/20 p-2">
                          {variants.map((variant) => {
                            const isSelected = selectedIds.includes(variant.id);
                            return (
                              <li key={variant.id}>
                                <button
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                                    isSelected
                                      ? "bg-primary/10 ring-1 ring-primary/25"
                                      : "hover:bg-background",
                                  )}
                                  onClick={() => toggleId(variant.id)}
                                  type="button"
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    className="pointer-events-none"
                                    tabIndex={-1}
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                      {variant.title}
                                    </span>
                                    {variant.sku ? (
                                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                        {variant.sku}
                                      </span>
                                    ) : null}
                                  </span>
                                  {variant.priceLabel ? (
                                    <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                                      {variant.priceLabel}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {canLoadMore && filtered.length > 0 ? (
              <div className="border-t p-3">
                <Button
                  className="w-full"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {loadingMore
                    ? t("common.loadingProducts")
                    : t("products.catalogPicker.loadMore")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t bg-muted/40 p-4 sm:justify-between">
          <p className="self-center text-sm text-muted-foreground">
            {selectedIds.length === 0
              ? t("products.catalogPicker.noneSelected")
              : selectedIds.length === 1
                ? selectionTarget === "variant"
                  ? t("products.catalogPicker.oneOptionSelected")
                  : t("common.productSelected")
                : selectionTarget === "variant"
                  ? t("products.catalogPicker.optionsSelected", { count: selectedIds.length })
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

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-md border",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background",
      )}
    >
      {selected ? <AppIcons.check className="size-3.5" /> : null}
    </span>
  );
}

function ProductPickThumb({ title, url }: { title: string; url?: string | null }) {
  if (url) {
    return (
      // biome-ignore lint/performance/noImgElement: product thumbnail from commerce CDN
      <img
        alt=""
        className="size-14 shrink-0 rounded-xl border object-cover"
        src={url}
      />
    );
  }
  const initial = title.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="grid size-14 shrink-0 place-items-center rounded-xl border bg-muted text-base font-semibold text-muted-foreground">
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
