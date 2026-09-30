import type { ProductCatalogPickProduct } from "@/features/products/product-catalog-picker-model";
import { resolveProductColorSwatch } from "@/lib/product-color";

export type SaleLine = { quantity: number; unitPrice: number | null; variantId: string };

export type VariantDetail = {
  availableQuantity: number | null;
  currencyCode: string;
  imageUrl: string | null;
  priceAmount: number | null;
  priceLabel: string | null;
  productId: string;
  productTitle: string;
  sku: string | null;
  variantId: string;
  variantTitle: string;
};

export type QuickSaleProduct = ProductCatalogPickProduct & {
  categoryIds: string[];
};

export type CatalogCategory = { id: string; mediaUrl: string | null; name: string };
export type DiscountType = "none" | "fixed" | "percentage";
export type Tender = "cash" | "telebirr" | "cbe_birr" | "bank_transfer" | "other";

export type CatalogResponse = { count?: number; products?: CatalogProduct[] };
export type CatalogCategoryResponse = {
  categories?: Array<{ id: string; mediaUrl?: string | null; name?: string | null }>;
};

type CatalogProduct = {
  categoryIds?: string[];
  id: string;
  options?: Array<{
    title: string;
    values: Array<{
      label: string;
      swatch?: { kind: "color"; value: string } | { kind: "image"; url: string } | undefined;
    }>;
  }>;
  thumbnail?: string | null;
  title?: string | null;
  variants?: Array<{
    id: string;
    imageUrl?: string | null;
    optionValues?: Array<{
      optionTitle?: string | null;
      value?: string | null;
    }>;
    prices?: Array<{ amount?: number | null; currencyCode?: string | null }>;
    sku?: string | null;
    stock?: { availableQuantity?: number | null; stockedQuantity?: number | null } | null;
    title?: string | null;
  }>;
};

export function mapCatalog(
  products: CatalogProduct[],
  t: (key: "orders.create.productFallback" | "orders.create.defaultOption") => string,
) {
  const variants: VariantDetail[] = [];
  const mapped: QuickSaleProduct[] = products.map((product) => ({
    categoryIds: product.categoryIds ?? [],
    id: product.id,
    searchText: [
      product.title,
      product.id,
      ...(product.variants ?? []).flatMap((variant) => [variant.title, variant.sku, variant.id]),
    ]
      .filter(Boolean)
      .join(" "),
    thumbnailUrl: product.thumbnail ?? null,
    title: product.title ?? t("orders.create.productFallback"),
    variants: (product.variants ?? []).map((variant) => {
      const price = variant.prices?.[0];
      const availableQuantity =
        variant.stock == null
          ? null
          : (variant.stock.availableQuantity ?? variant.stock.stockedQuantity ?? null);
      const title = variant.title ?? t("orders.create.defaultOption");
      const priceLabel =
        price?.amount == null
          ? null
          : `${price.amount} ${(price.currencyCode ?? "etb").toUpperCase()}`;
      const options = Object.fromEntries(
        (variant.optionValues ?? []).flatMap((option) =>
          option.optionTitle && option.value ? [[option.optionTitle, option.value]] : [],
        ),
      );
      const optionSwatches: Record<string, string> = {};
      for (const [optionTitle, value] of Object.entries(options)) {
        const swatch = product.options
          ?.find(
            (option) =>
              option.title.localeCompare(optionTitle, undefined, { sensitivity: "base" }) === 0,
          )
          ?.values.find(
            (option) => option.label.localeCompare(value, undefined, { sensitivity: "base" }) === 0,
          )?.swatch;
        const resolved =
          swatch?.kind === "image"
            ? swatch.url
            : resolveProductColorSwatch(
                optionTitle,
                value,
                swatch?.kind === "color" ? swatch.value : undefined,
              );
        if (resolved) optionSwatches[optionTitle] = resolved;
      }

      variants.push({
        availableQuantity,
        currencyCode: price?.currencyCode ?? "etb",
        imageUrl: variant.imageUrl ?? product.thumbnail ?? null,
        priceAmount: price?.amount ?? null,
        priceLabel,
        productId: product.id,
        productTitle: product.title ?? t("orders.create.productFallback"),
        sku: variant.sku ?? null,
        variantId: variant.id,
        variantTitle: title,
      });
      return {
        availableQuantity,
        id: variant.id,
        options,
        optionSwatches,
        priceLabel,
        sku: variant.sku ?? null,
        title,
      };
    }),
  }));
  return { products: mapped, variants };
}

export function quickSaleEmptyState({ categoryId, query }: { categoryId: string; query: string }) {
  if (query.trim()) return "search" as const;
  if (categoryId !== "all") return "category" as const;
  return "catalog" as const;
}

export function mergeProducts(current: QuickSaleProduct[], next: QuickSaleProduct[]) {
  const merged = new Map(current.map((product) => [product.id, product]));
  for (const product of next) merged.set(product.id, product);
  return [...merged.values()];
}

export function mergeVariantDetails(current: VariantDetail[], next: VariantDetail[]) {
  const merged = new Map(current.map((variant) => [variant.variantId, variant]));
  for (const variant of next) {
    if (!merged.has(variant.variantId)) merged.set(variant.variantId, variant);
  }
  return [...merged.values()];
}

export function productAvailability(product: QuickSaleProduct) {
  const quantities = (product.variants ?? []).map((variant) => variant.availableQuantity);
  if (quantities.some((quantity) => quantity == null)) return null;
  return quantities.reduce<number>((sum, quantity) => sum + (quantity ?? 0), 0);
}

export function formatEtb(
  value: number,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
) {
  return `${formatNumber(value, { maximumFractionDigits: 2 })} ETB`;
}
