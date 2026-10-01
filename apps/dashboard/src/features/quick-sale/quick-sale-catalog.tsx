"use client";

import { type PointerEvent, useRef, useState } from "react";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildProductOptionAxes,
  isVariantOutOfStock,
  lowestPriceLabel,
} from "@/features/products/product-catalog-picker-model";
import { ProductOptionConfigurator } from "@/features/products/product-catalog-picker-parts";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { CatalogCategory, QuickSaleProduct } from "./quick-sale-model";
import { productAvailability, quickSaleEmptyState } from "./quick-sale-model";

const PRODUCT_SKELETONS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

export function QuickSaleCatalog({
  categoriesError,
  categoriesLoading,
  categoryId,
  categories,
  error,
  hasMore,
  loading,
  loadingMore,
  onAddVariant,
  onCategoryChange,
  onLoadMore,
  onRetryCategories,
  onRetryProducts,
  products,
  query,
}: {
  categoriesError: boolean;
  categoriesLoading: boolean;
  categoryId: string;
  categories: CatalogCategory[];
  error: boolean;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  onAddVariant: (variantId: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onLoadMore: () => void;
  onRetryCategories: () => void;
  onRetryProducts: () => void;
  products: QuickSaleProduct[];
  query: string;
}) {
  const { t } = useI18n();
  const [activeProduct, setActiveProduct] = useState<QuickSaleProduct | null>(null);
  const emptyState = quickSaleEmptyState({ categoryId, query });
  const categoryScroller = useRef<HTMLFieldSetElement>(null);
  const categoryDrag = useRef<{
    moved: boolean;
    pointerId: number;
    scrollLeft: number;
    startX: number;
  } | null>(null);
  const suppressCategoryClick = useRef(false);

  function startCategoryDrag(event: PointerEvent<HTMLFieldSetElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    categoryDrag.current = {
      moved: false,
      pointerId: event.pointerId,
      scrollLeft: event.currentTarget.scrollLeft,
      startX: event.clientX,
    };
  }

  function moveCategoryDrag(event: PointerEvent<HTMLFieldSetElement>) {
    const drag = categoryDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4 && !drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    event.currentTarget.scrollLeft = drag.scrollLeft - distance;
    event.preventDefault();
  }

  function finishCategoryDrag(event: PointerEvent<HTMLFieldSetElement>) {
    const drag = categoryDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressCategoryClick.current = drag.moved;
    categoryDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function chooseProduct(product: QuickSaleProduct) {
    const available = (product.variants ?? []).filter((variant) => !isVariantOutOfStock(variant));
    const onlyVariant = available[0];
    if (onlyVariant && available.length === 1 && product.variants?.length === 1) {
      onAddVariant(onlyVariant.id);
      return;
    }
    if (available.length > 0) setActiveProduct(product);
  }

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
      aria-label={t("quickSale.products")}
    >
      <div className="shrink-0 border-b bg-background px-3 py-2.5 sm:px-4">
        {categoriesLoading ? (
          <output
            aria-label={t("quickSale.categoriesLoading")}
            className="flex h-9 items-center gap-2 overflow-hidden"
          >
            {["all", "one", "two", "three"].map((id, index) => (
              <Skeleton
                className={cn("h-9 shrink-0 rounded-full", index === 0 ? "w-20" : "w-28")}
                key={id}
              />
            ))}
          </output>
        ) : (
          <fieldset
            className="flex min-w-0 max-w-full cursor-grab gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5 select-none touch-pan-x active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onClickCapture={(event) => {
              if (!suppressCategoryClick.current) return;
              event.preventDefault();
              event.stopPropagation();
              suppressCategoryClick.current = false;
            }}
            onPointerCancel={finishCategoryDrag}
            onPointerDown={startCategoryDrag}
            onPointerMove={moveCategoryDrag}
            onPointerUp={finishCategoryDrag}
            ref={categoryScroller}
          >
            <legend className="sr-only">{t("quickSale.categories")}</legend>
            <CategoryButton
              active={categoryId === "all"}
              icon={AppIcons.grid}
              label={t("quickSale.allProducts")}
              onClick={() => onCategoryChange("all")}
            />
            {categories.map((category) => (
              <CategoryButton
                active={categoryId === category.id}
                key={category.id}
                label={category.name}
                mediaUrl={category.mediaUrl}
                onClick={() => onCategoryChange(category.id)}
              />
            ))}
            {categoriesError ? (
              <button
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-destructive/25 bg-destructive/5 px-3 text-xs font-medium text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={onRetryCategories}
                type="button"
              >
                <AppIcons.error className="size-3.5" />
                {t("quickSale.categoriesLoadFailed")}
                <AppIcons.refresh className="size-3.5" />
              </button>
            ) : categories.length === 0 ? (
              <span className="flex h-9 shrink-0 items-center px-1 text-xs text-muted-foreground">
                {t("quickSale.noCategories")}
              </span>
            ) : null}
          </fieldset>
        )}
      </div>

      <div
        aria-busy={loading || loadingMore || undefined}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4"
      >
        {loading ? (
          <output aria-label={t("quickSale.productsLoading")} className="block">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {PRODUCT_SKELETONS.map((id) => (
                <div className="overflow-hidden rounded-xl border" key={id}>
                  <Skeleton className="aspect-[4/3] rounded-none" />
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </output>
        ) : error ? (
          <CatalogState
            actionLabel={t("common.tryAgain")}
            description={t("quickSale.productsLoadFailedDescription")}
            icon={AppIcons.error}
            onAction={onRetryProducts}
            title={t("quickSale.productsLoadFailed")}
            tone="error"
          />
        ) : products.length === 0 ? (
          <CatalogState
            description={
              emptyState === "search"
                ? t("quickSale.noProductsSearchDescription")
                : emptyState === "category"
                  ? t("quickSale.noProductsCategoryDescription")
                  : t("quickSale.noProductsCatalogDescription")
            }
            icon={emptyState === "search" ? AppIcons.search : AppIcons.shoppingBag}
            title={t("quickSale.noProducts")}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {products.map((product) => (
                <ProductTile
                  key={product.id}
                  onChoose={() => chooseProduct(product)}
                  product={product}
                />
              ))}
            </div>
            {hasMore ? (
              <div className="flex justify-center py-5">
                <Button disabled={loadingMore} onClick={onLoadMore} variant="outline">
                  {loadingMore ? <AppIcons.loader className="animate-spin" /> : null}
                  {t("quickSale.loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Sheet open={Boolean(activeProduct)} onOpenChange={(open) => !open && setActiveProduct(null)}>
        <SheetContent className="w-full sm:max-w-md" side="right">
          {activeProduct ? (
            <>
              <SheetHeader>
                <SheetTitle>{activeProduct.title}</SheetTitle>
                <SheetDescription>{t("quickSale.chooseOption")}</SheetDescription>
              </SheetHeader>
              <SheetBody className="p-0">
                <ProductHero product={activeProduct} />
                <ProductOptionConfigurator
                  axes={buildProductOptionAxes(activeProduct.variants ?? [], activeProduct.title)}
                  onAdd={(variantId) => {
                    onAddVariant(variantId);
                    setActiveProduct(null);
                  }}
                  productTitle={activeProduct.title}
                  selectionMode="single"
                  variants={activeProduct.variants ?? []}
                />
              </SheetBody>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CatalogState({
  actionLabel,
  description,
  icon: Icon,
  onAction,
  title,
  tone = "empty",
}: {
  actionLabel?: string;
  description: string;
  icon: typeof AppIcons.products;
  onAction?: () => void;
  title: string;
  tone?: "empty" | "error";
}) {
  return (
    <div className="grid min-h-72 place-items-center px-4 text-center">
      <div className="flex max-w-sm flex-col items-center">
        <span
          className={cn(
            "mb-3 grid size-11 place-items-center rounded-full border bg-muted/40 text-muted-foreground",
            tone === "error" && "border-destructive/20 bg-destructive/5 text-destructive",
          )}
        >
          <Icon className="size-5" />
        </span>
        <p className="font-medium">{title}</p>
        <p className="mt-1 max-w-xs text-sm text-pretty text-muted-foreground">{description}</p>
        {onAction && actionLabel ? (
          <Button className="mt-4" onClick={onAction} size="sm" variant="outline">
            <AppIcons.refresh />
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CategoryButton({
  active,
  icon: Icon,
  label,
  mediaUrl,
  onClick,
}: {
  active: boolean;
  icon?: typeof AppIcons.grid;
  label: string;
  mediaUrl?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-full border px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "border-primary/35 bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:border-foreground/15 hover:bg-muted hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground",
          active && "bg-primary/10 text-primary",
        )}
      >
        {mediaUrl ? (
          // biome-ignore lint/performance/noImgElement: category media may use merchant media hosts.
          <img alt="" className="size-full object-cover" loading="lazy" src={mediaUrl} />
        ) : Icon ? (
          <Icon className="size-4" />
        ) : (
          <span className="text-xs font-semibold uppercase">{label.slice(0, 1)}</span>
        )}
      </span>
      <span>{label}</span>
    </button>
  );
}

function ProductTile({ onChoose, product }: { onChoose: () => void; product: QuickSaleProduct }) {
  const { t } = useI18n();
  const availability = productAvailability(product);
  const soldOut = availability === 0 || !(product.variants?.length ?? 0);
  const price = lowestPriceLabel(product.variants ?? []);

  return (
    <button
      className={cn(
        "group min-w-0 overflow-hidden rounded-xl border bg-card text-left outline-none transition-[border-color,background-color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        soldOut
          ? "cursor-not-allowed opacity-55"
          : "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md active:translate-y-0",
      )}
      disabled={soldOut}
      onClick={onChoose}
      type="button"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b bg-muted/45">
        {product.thumbnailUrl ? (
          // biome-ignore lint/performance/noImgElement: commerce thumbnails may come from merchant media hosts.
          <img
            alt=""
            className="size-full object-cover transition-transform duration-200 ease-[var(--ease-dashboard)] group-hover:scale-[1.025]"
            loading="lazy"
            src={product.thumbnailUrl}
          />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground/60">
            <AppIcons.image className="size-7" />
          </span>
        )}
        {soldOut ? (
          <span className="absolute right-2 bottom-2 rounded-full bg-background/95 px-2 py-1 text-xs font-medium text-foreground shadow-sm">
            {t("quickSale.outOfStock")}
          </span>
        ) : null}
      </div>
      <span className="block space-y-1 p-3">
        <span className="block truncate text-sm font-medium">{product.title}</span>
        <span className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate font-mono font-medium tabular-nums text-foreground">
            {price ?? t("quickSale.noPrice")}
          </span>
          <span className="shrink-0 text-muted-foreground">
            {availability == null
              ? t("quickSale.stockUntracked")
              : t("quickSale.inStock", { count: availability })}
          </span>
        </span>
      </span>
    </button>
  );
}

function ProductHero({ product }: { product: QuickSaleProduct }) {
  return (
    <div className="border-b bg-muted/20 p-4">
      <div className="aspect-[16/9] overflow-hidden rounded-xl border bg-muted/45">
        {product.thumbnailUrl ? (
          // biome-ignore lint/performance/noImgElement: commerce thumbnails may come from merchant media hosts.
          <img alt="" className="size-full object-cover" src={product.thumbnailUrl} />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground/60">
            <AppIcons.image className="size-8" />
          </span>
        )}
      </div>
    </div>
  );
}
