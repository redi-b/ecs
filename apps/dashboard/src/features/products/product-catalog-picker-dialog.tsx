"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "@/components/app/link";
import { AppIcons } from "@/components/app/icons";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

import {
  buildProductOptionAxes,
  formatVariantChipLabel,
  isVariantOutOfStock,
  lowestPriceLabel,
  PRODUCT_CATALOG_PAGE_SIZE,
  type ProductCatalogPickItem,
  type ProductCatalogPickProduct,
} from "./product-catalog-picker-model";
import {
  ProductOptionConfigurator,
  ProductPickThumb,
  SelectionMark,
} from "./product-catalog-picker-parts";

// Re-export public API so existing imports keep working.
export type {
  ProductCatalogPickItem,
  ProductCatalogPickProduct,
  ProductCatalogPickVariant,
  ProductOptionAxis,
} from "./product-catalog-picker-model";
export {
  buildProductOptionAxes,
  optionLabelFromVariantTitle,
  resolveVariantByOptions,
} from "./product-catalog-picker-model";

type ProductCatalogPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: ProductCatalogPickItem[];
  products?: ProductCatalogPickProduct[];
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
  /**
   * When true, Confirm works with zero selection (e.g. clear featured products).
   * Default false preserves order-line “must pick something” behavior.
   */
  allowEmptySelection?: boolean;
  onConfirm: (ids: string[]) => void;
  showCreateProductLink?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
};

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
  allowEmptySelection = false,
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
  const [visibleCount, setVisibleCount] = useState(PRODUCT_CATALOG_PAGE_SIZE);
  /** Which product's option configurator is open. */
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  const catalogProducts = useMemo(() => {
    if (products?.length) return products;
    return items.map(
      (item): ProductCatalogPickProduct => ({
        id: item.id,
        title: item.title,
        handle: item.subtitle?.startsWith("/") ? item.subtitle.slice(1) : null,
        thumbnailUrl: item.thumbnailUrl ?? null,
        searchText: item.searchText,
      }),
    );
  }, [items, products]);

  const selectionTarget: "product" | "variant" =
    selectionTargetProp ??
    (products?.some((p) => (p.variants?.length ?? 0) > 0) ? "variant" : "product");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setVisibleCount(PRODUCT_CATALOG_PAGE_SIZE);
      setActiveProductId(null);
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
        [variant.title, variant.sku, variant.id, ...Object.values(variant.options ?? {})]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    });
  }, [catalogProducts, query]);

  const pageItems = filtered.slice(0, visibleCount);
  const canShowMoreClient = visibleCount < filtered.length;
  const canLoadMore = Boolean(onLoadMore && hasMore) || canShowMoreClient;

  function setIds(next: string[]) {
    if (maxSelection && next.length > maxSelection) {
      setSelectedIds(next.slice(0, maxSelection));
      return;
    }
    setSelectedIds(next);
  }

  function findVariant(id: string) {
    for (const product of catalogProducts) {
      const match = (product.variants ?? []).find((variant) => variant.id === id);
      if (match) return match;
    }
    return null;
  }

  function toggleId(id: string) {
    const variant = findVariant(id);
    if (variant && isVariantOutOfStock(variant) && !selectedIds.includes(id)) return;
    if (!isMultiple) {
      setIds(selectedIds[0] === id ? [] : [id]);
      return;
    }
    if (selectedIds.includes(id)) setIds(selectedIds.filter((item) => item !== id));
    else setIds([...selectedIds, id]);
  }

  function addVariantId(id: string) {
    const variant = findVariant(id);
    if (variant && isVariantOutOfStock(variant)) return;
    if (!isMultiple) {
      setIds([id]);
      return;
    }
    if (selectedIds.includes(id)) return;
    setIds([...selectedIds, id]);
  }

  function productSelectedVariantIds(product: ProductCatalogPickProduct) {
    const ids = new Set((product.variants ?? []).map((v) => v.id));
    return selectedIds.filter((id) => ids.has(id));
  }

  function confirm() {
    if (!selectedIds.length && !allowEmptySelection) return;
    onConfirm(selectedIds);
    onOpenChange(false);
  }

  function clearAll() {
    setIds([]);
  }

  function handleLoadMore() {
    if (canShowMoreClient) {
      setVisibleCount((count) => count + PRODUCT_CATALOG_PAGE_SIZE);
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
        className="z-[70] flex max-h-[min(90vh,48rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
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
              setVisibleCount(PRODUCT_CATALOG_PAGE_SIZE);
            }}
            placeholder={searchPlaceholder ?? t("common.searchProducts")}
            value={query}
          />

          <p className="text-sm text-muted-foreground">
            {loading
              ? t("common.loadingProducts")
              : t("products.catalogPicker.count", { count: filtered.length })}
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border bg-card/60">
            {loading && catalogProducts.length === 0 ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div className="flex items-center gap-3 rounded-2xl border p-3" key={index}>
                    <Skeleton className="size-12 shrink-0 rounded-full" />
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
              <ul className="space-y-2.5 p-3">
                {pageItems.map((product) => {
                  const variants = product.variants ?? [];
                  const isVariantMode = selectionTarget === "variant" && variants.length > 0;

                  if (!isVariantMode) {
                    const isSelected = selectedIds.includes(product.id);
                    return (
                      <li key={product.id}>
                        <button
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition-colors",
                            isSelected
                              ? "border-primary/45 bg-primary/[0.06] shadow-sm ring-2 ring-primary/12"
                              : "hover:border-foreground/15 hover:bg-muted/20",
                          )}
                          onClick={() => toggleId(product.id)}
                          type="button"
                        >
                          <SelectionMark selected={isSelected} />
                          <ProductPickThumb title={product.title} url={product.thumbnailUrl} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold tracking-tight">
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

                  if (variants.length === 1) {
                    const variant = variants[0]!;
                    const isSelected = selectedIds.includes(variant.id);
                    const oos = isVariantOutOfStock(variant);
                    return (
                      <li key={product.id}>
                        <button
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition-colors",
                            isSelected
                              ? "border-primary/45 bg-primary/[0.06] shadow-sm ring-2 ring-primary/12"
                              : "hover:border-foreground/15 hover:bg-muted/20",
                            oos && "cursor-not-allowed opacity-55 hover:border-border hover:bg-card",
                          )}
                          disabled={oos}
                          onClick={() => {
                            if (oos) return;
                            toggleId(variant.id);
                          }}
                          type="button"
                        >
                          <SelectionMark selected={isSelected} />
                          <ProductPickThumb title={product.title} url={product.thumbnailUrl} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold tracking-tight">
                              {product.title}
                            </span>
                            {oos ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {t("products.catalogPicker.outOfStock")}
                              </span>
                            ) : null}
                          </span>
                          {variant.priceLabel ? (
                            <span className="shrink-0 text-sm font-semibold tabular-nums tracking-tight">
                              {variant.priceLabel}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  }

                  const selectedForProduct = productSelectedVariantIds(product);
                  const hasSelection = selectedForProduct.length > 0;
                  const isActive = activeProductId === product.id;
                  const axes = buildProductOptionAxes(variants, product.title);
                  const priceHint = lowestPriceLabel(variants);

                  return (
                    <li key={product.id}>
                      <Collapsible
                        className={cn(
                          "overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow] duration-200",
                          hasSelection && "border-primary/35 shadow-sm",
                          isActive && "border-primary/40 ring-2 ring-primary/10",
                        )}
                        onOpenChange={(open) => {
                          setActiveProductId(open ? product.id : null);
                        }}
                        open={isActive}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-muted/15"
                            type="button"
                          >
                            <ProductPickThumb title={product.title} url={product.thumbnailUrl} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold tracking-tight">
                                {product.title}
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                                <span>
                                  {t("products.catalogPicker.optionCount", {
                                    count: variants.length,
                                  })}
                                </span>
                                {priceHint ? (
                                  <>
                                    <span className="text-border">·</span>
                                    <span>
                                      {t("products.catalogPicker.fromPrice", {
                                        price: priceHint,
                                      })}
                                    </span>
                                  </>
                                ) : null}
                                {hasSelection ? (
                                  <>
                                    <span className="text-border">·</span>
                                    <span className="font-medium text-primary">
                                      {t("products.catalogPicker.selectedCountShort", {
                                        count: selectedForProduct.length,
                                      })}
                                    </span>
                                  </>
                                ) : null}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "grid size-8 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground transition-colors duration-200",
                                isActive && "border-primary/30 bg-primary/5 text-primary",
                              )}
                            >
                              <AppIcons.arrowDown
                                className={cn(
                                  "size-4 transition-transform duration-200 ease-out",
                                  isActive && "rotate-180",
                                )}
                              />
                            </span>
                          </button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <ProductOptionConfigurator
                            axes={axes}
                            onAdd={(variantId) => {
                              addVariantId(variantId);
                            }}
                            productTitle={product.title}
                            selectionMode={selectionMode}
                            variants={variants}
                          />
                        </CollapsibleContent>

                        {hasSelection ? (
                          <div className="flex flex-wrap gap-1.5 border-t bg-muted/10 px-3.5 py-2.5 animate-in fade-in-0 duration-150">
                            {selectedForProduct.map((id) => {
                              const variant = variants.find((item) => item.id === id);
                              if (!variant) return null;
                              return (
                                <span
                                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/5 py-1 pr-1 pl-2.5 text-xs font-medium"
                                  key={id}
                                >
                                  <span className="truncate">
                                    {formatVariantChipLabel(variant)}
                                    {variant.priceLabel ? (
                                      <span className="ml-1 font-normal text-muted-foreground">
                                        {variant.priceLabel}
                                      </span>
                                    ) : null}
                                  </span>
                                  <button
                                    aria-label={t("common.clearSelection")}
                                    className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-foreground/10"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleId(id);
                                    }}
                                    type="button"
                                  >
                                    <AppIcons.close className="size-3 opacity-60" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        ) : null}
                      </Collapsible>
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

        <DialogFooter className="mx-0 mb-0 shrink-0 flex-col gap-2 rounded-none border-t bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {isMultiple && selectedIds.length > 0 ? (
              <Button onClick={clearAll} type="button" variant="ghost">
                {t("common.clearSelection")}
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              {t("common.cancel")}
            </Button>
            <Button
              disabled={selectedIds.length === 0 && !allowEmptySelection}
              onClick={confirm}
              type="button"
            >
              {confirmLabel
                ? confirmLabel
                : selectedIds.length === 0
                  ? allowEmptySelection
                    ? t("common.save")
                    : t("products.catalogPicker.addSelected")
                  : selectedIds.length === 1
                    ? t("products.catalogPicker.addSelected")
                    : t("products.catalogPicker.addSelectedCount", {
                        count: selectedIds.length,
                      })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
