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

/** Flat pick item (product-level selection: collections, promotions). */
export type ProductCatalogPickItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  searchText: string;
  meta?: string | null;
};

/** Variant under a product (order lines). */
export type ProductCatalogPickVariant = {
  id: string;
  title: string;
  sku?: string | null;
  priceLabel?: string | null;
  /** Structured options: { Size: "M", Color: "Blue" }. */
  options?: Record<string, string>;
};

export type ProductCatalogPickProduct = {
  id: string;
  title: string;
  handle?: string | null;
  thumbnailUrl?: string | null;
  searchText: string;
  variants?: ProductCatalogPickVariant[];
};

export type ProductOptionAxis = {
  title: string;
  values: string[];
};

const PAGE_SIZE = 24;

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
  onConfirm: (ids: string[]) => void;
  showCreateProductLink?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
};

/**
 * Strip product title from Medusa variant titles like "Denim Jacket / XL" → "XL".
 */
export function optionLabelFromVariantTitle(
  variantTitle: string,
  productTitle?: string | null,
): string {
  let rest = variantTitle.trim();
  const product = productTitle?.trim();
  if (product && rest.toLowerCase().startsWith(product.toLowerCase())) {
    rest = rest.slice(product.length).replace(/^\s*[·/\-–—|:]\s*/, "").trim();
  }
  return rest || variantTitle.trim();
}

/**
 * Build option axes (Size, Color, …) from variants.
 * Prefers structured `options` from Medusa (option name + values from product create).
 * Title fallback only when options are missing — never treats product name as a value.
 */
export function buildProductOptionAxes(
  variants: ProductCatalogPickVariant[],
  productTitle?: string | null,
): ProductOptionAxis[] {
  const map = new Map<string, Set<string>>();
  let structured = false;

  for (const variant of variants) {
    const opts = variant.options ?? {};
    const entries = Object.entries(opts).filter(
      ([title, value]) => title && value && title !== "Default",
    );
    if (entries.length > 0) {
      structured = true;
      for (const [title, value] of entries) {
        const set = map.get(title) ?? new Set<string>();
        set.add(value);
        map.set(title, set);
      }
    }
  }

  if (structured) {
    return [...map.entries()].map(([title, values]) => ({
      title,
      values: [...values].sort((a, b) => a.localeCompare(b)),
    }));
  }

  // Fallback only: option values from titles, product name stripped first.
  const partsList = variants
    .map((v) =>
      optionLabelFromVariantTitle(v.title, productTitle)
        .split(/\s*\/\s*/)
        .map((p) => p.trim())
        .filter(Boolean),
    )
    .filter((parts) => parts.length > 0);

  if (partsList.length === 0) {
    return [];
  }

  const maxParts = Math.max(...partsList.map((p) => p.length));
  if (maxParts === 1) {
    const values = [...new Set(partsList.map((p) => p[0]!).filter(Boolean))];
    if (values.length <= 1) return [];
    // Unknown option name without Medusa options payload — generic label.
    return [{ title: "Option", values: values.sort((a, b) => a.localeCompare(b)) }];
  }

  const axes: ProductOptionAxis[] = [];
  for (let i = 0; i < maxParts; i++) {
    const values = new Set<string>();
    for (const parts of partsList) {
      if (parts[i]) values.add(parts[i]!);
    }
    if (values.size > 0) {
      axes.push({
        title: `Option ${i + 1}`,
        values: [...values].sort((a, b) => a.localeCompare(b)),
      });
    }
  }
  return axes;
}

export function resolveVariantByOptions(
  variants: ProductCatalogPickVariant[],
  selection: Record<string, string>,
): ProductCatalogPickVariant | null {
  const keys = Object.keys(selection);
  if (!keys.length) return null;

  const structured = variants.find((variant) => {
    const opts = variant.options ?? {};
    if (!Object.keys(opts).length) return false;
    return keys.every((key) => opts[key] === selection[key]);
  });
  if (structured) return structured;

  // Title fallback: match option values only (product name already stripped by caller axes).
  const orderedValues = Object.values(selection);
  return (
    variants.find((variant) => {
      const opts = variant.options ?? {};
      if (Object.keys(opts).length) return false;
      const label = optionLabelFromVariantTitle(variant.title);
      const parts = label
        .split(/\s*\/\s*/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (orderedValues.length === 1) {
        return label === orderedValues[0] || parts[0] === orderedValues[0];
      }
      if (parts.length !== orderedValues.length) return false;
      return orderedValues.every((value, index) => parts[index] === value);
    }) ?? null
  );
}

/**
 * Premium catalog picker.
 * Multi-option products (Size × Color) use per-axis pickers, not a flat list of combos.
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
  /** Which product's option configurator is open. */
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  const catalogProducts = useMemo(() => {
    if (products?.length) return products;
    return items.map(
      (item): ProductCatalogPickProduct => ({
        id: item.id,
        title: item.title,
        handle: item.subtitle?.startsWith("/") ? item.subtitle.slice(1) : null,
        thumbnailUrl: item.thumbnailUrl,
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
      setVisibleCount(PAGE_SIZE);
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

  function toggleId(id: string) {
    if (!isMultiple) {
      setIds(selectedIds[0] === id ? [] : [id]);
      return;
    }
    if (selectedIds.includes(id)) setIds(selectedIds.filter((item) => item !== id));
    else setIds([...selectedIds, id]);
  }

  function addVariantId(id: string) {
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
              setVisibleCount(PAGE_SIZE);
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
                    return (
                      <li key={product.id}>
                        <button
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition-colors",
                            isSelected
                              ? "border-primary/45 bg-primary/[0.06] shadow-sm ring-2 ring-primary/12"
                              : "hover:border-foreground/15 hover:bg-muted/20",
                          )}
                          onClick={() => toggleId(variant.id)}
                          type="button"
                        >
                          <SelectionMark selected={isSelected} />
                          <ProductPickThumb title={product.title} url={product.thumbnailUrl} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold tracking-tight">
                              {product.title}
                            </span>
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
                    <li
                      className={cn(
                        "overflow-hidden rounded-2xl border bg-card transition-shadow",
                        hasSelection && "border-primary/35 shadow-sm",
                        isActive && "border-primary/40 ring-2 ring-primary/10",
                      )}
                      key={product.id}
                    >
                      <button
                        className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-muted/15"
                        onClick={() =>
                          setActiveProductId((current) =>
                            current === product.id ? null : product.id,
                          )
                        }
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
                                  {t("products.catalogPicker.fromPrice", { price: priceHint })}
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
                            "grid size-8 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground transition-colors",
                            isActive && "border-primary/30 bg-primary/5 text-primary",
                          )}
                        >
                          <AppIcons.arrowDown
                            className={cn(
                              "size-4 transition-transform",
                              isActive && "rotate-180",
                            )}
                          />
                        </span>
                      </button>

                      {isActive ? (
                        <ProductOptionConfigurator
                          axes={axes}
                          onAdd={(variantId) => {
                            addVariantId(variantId);
                          }}
                          productTitle={product.title}
                          selectionMode={selectionMode}
                          variants={variants}
                        />
                      ) : null}

                      {hasSelection ? (
                        <div className="flex flex-wrap gap-1.5 border-t bg-muted/10 px-3.5 py-2.5">
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

        <DialogFooter className="mx-0 mb-0 shrink-0 gap-3 rounded-none border-t bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground sm:self-center">
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
            <Button
              className="rounded-full"
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={selectedIds.length === 0}
              onClick={confirm}
              type="button"
            >
              {confirmLabel ?? t("products.catalogPicker.addSelected")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductOptionConfigurator({
  axes,
  variants,
  onAdd,
  productTitle,
  selectionMode,
}: {
  axes: ProductOptionAxis[];
  variants: ProductCatalogPickVariant[];
  onAdd: (variantId: string) => void;
  productTitle: string;
  selectionMode: "single" | "multiple";
}) {
  const { t } = useI18n();
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [justAdded, setJustAdded] = useState(false);

  // Prefer first available values as defaults when axes exist.
  useEffect(() => {
    if (!axes.length) return;
    setPicks((current) => {
      if (Object.keys(current).length) return current;
      const next: Record<string, string> = {};
      for (const axis of axes) {
        if (axis.values[0]) next[axis.title] = axis.values[0];
      }
      return next;
    });
  }, [axes]);

  const resolved = useMemo(() => {
    if (axes.length === 0) return null;
    const complete = axes.every((axis) => Boolean(picks[axis.title]));
    if (!complete) return null;
    return resolveVariantByOptions(variants, picks);
  }, [axes, picks, variants]);

  function isValueAvailable(axisTitle: string, value: string) {
    const trial = { ...picks, [axisTitle]: value };
    return variants.some((variant) => {
      const opts = variant.options ?? {};
      if (Object.keys(opts).length) {
        return Object.entries(trial).every(([k, v]) => !v || opts[k] === v);
      }
      const label = optionLabelFromVariantTitle(variant.title, productTitle);
      const parts = label.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
      const axisIndex = axes.findIndex((a) => a.title === axisTitle);
      if (axisIndex < 0) return true;
      if (parts[axisIndex] !== value && label !== value) return false;
      return axes.every((axis, index) => {
        if (axis.title === axisTitle) return true;
        const picked = trial[axis.title];
        if (!picked) return true;
        return parts[index] === picked || (axes.length === 1 && label === picked);
      });
    });
  }

  function displayAxisTitle(title: string) {
    const normalized = title.trim().toLowerCase();
    if (
      !title ||
      normalized === "option" ||
      normalized === "variant" ||
      normalized === "default" ||
      /^option\s*\d+$/i.test(title)
    ) {
      return t("products.catalogPicker.optionsHeading");
    }
    return title;
  }

  // No structured axes → simple chips of option labels (not full combo SKUs).
  if (axes.length === 0) {
    return (
      <div className="space-y-2.5 border-t bg-muted/10 px-3.5 py-3.5">
        <p className="text-xs font-medium text-muted-foreground">
          {t("products.catalogPicker.pickOptionFor", { product: productTitle })}
        </p>
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => (
            <button
              className="rounded-full border bg-background px-3.5 py-2 text-sm font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              key={variant.id}
              onClick={() => onAdd(variant.id)}
              type="button"
            >
              {optionLabelFromVariantTitle(variant.title, productTitle)}
              {variant.priceLabel ? (
                <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">
                  {variant.priceLabel}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 border-t bg-muted/10 px-3.5 py-3.5">
      {axes.map((axis) => (
        <div className="space-y-2" key={axis.title}>
          <p className="text-xs font-semibold text-foreground/80">
            {displayAxisTitle(axis.title)}
          </p>
          <div className="flex flex-wrap gap-2">
            {axis.values.map((value) => {
              const active = picks[axis.title] === value;
              const available = isValueAvailable(axis.title, value);
              return (
                <button
                  className={cn(
                    "min-w-10 rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/80 bg-background shadow-sm hover:border-primary/35 hover:bg-primary/[0.04]",
                    !available && !active && "pointer-events-none opacity-30",
                  )}
                  disabled={!available && !active}
                  key={value}
                  onClick={() => {
                    setJustAdded(false);
                    setPicks((current) => ({
                      ...current,
                      [axis.title]: value,
                    }));
                  }}
                  type="button"
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 rounded-xl border bg-background/80 px-3 py-2.5 shadow-sm">
        <div className="min-w-0 flex-1">
          {resolved ? (
            <p className="text-sm font-semibold tabular-nums tracking-tight">
              {resolved.priceLabel ?? t("products.catalogPicker.readyToAdd")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("products.catalogPicker.completeOptions")}
            </p>
          )}
          {justAdded ? (
            <p className="mt-0.5 text-xs font-medium text-primary">
              {t("products.catalogPicker.addedHint")}
            </p>
          ) : null}
        </div>
        <Button
          className="shrink-0 rounded-full px-4"
          disabled={!resolved}
          onClick={() => {
            if (!resolved) return;
            onAdd(resolved.id);
            setJustAdded(true);
          }}
          size="sm"
          type="button"
        >
          {selectionMode === "multiple"
            ? t("products.catalogPicker.addCombination")
            : t("products.catalogPicker.selectCombination")}
        </Button>
      </div>
    </div>
  );
}

function lowestPriceLabel(variants: ProductCatalogPickVariant[]): string | null {
  let best: number | null = null;
  let label: string | null = null;
  for (const variant of variants) {
    if (!variant.priceLabel) continue;
    const n = Number(variant.priceLabel.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n)) {
      if (!label) label = variant.priceLabel;
      continue;
    }
    if (best == null || n < best) {
      best = n;
      label = variant.priceLabel;
    }
  }
  return label;
}

function formatVariantChipLabel(variant: ProductCatalogPickVariant) {
  const opts = variant.options ?? {};
  const parts = Object.values(opts).filter(Boolean);
  if (parts.length) return parts.join(" · ");
  // Prefer "XL" over "Denim Jacket / XL" when options payload was missing.
  return optionLabelFromVariantTitle(variant.title);
}

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background",
      )}
    >
      {selected ? <AppIcons.check className="size-3" /> : null}
    </span>
  );
}

function ProductPickThumb({ title, url }: { title: string; url?: string | null }) {
  if (url) {
    return (
      // biome-ignore lint/performance/noImgElement: product thumbnail from commerce CDN
      <img
        alt=""
        className="size-12 shrink-0 rounded-full border object-cover shadow-sm"
        src={url}
      />
    );
  }
  const initial = title.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-full border bg-muted text-sm font-semibold text-muted-foreground shadow-sm">
      {initial}
    </span>
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
