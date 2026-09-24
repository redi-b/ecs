import type { ProductSearchDocument } from "../modules/meilisearch/types";

type RelatedValue = { id?: string | null; name?: string | null; title?: string | null; value?: string | null };
type CalculatedPrice = { calculated_amount?: number | null; currency_code?: string | null };
type VariantPrice = { amount?: number | null; currency_code?: string | null };
export type ProductSearchSource = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
  status?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  sales_channels?: RelatedValue[] | null;
  categories?: RelatedValue[] | null;
  collection?: RelatedValue | null;
  tags?: RelatedValue[] | null;
  options?: Array<{ title?: string | null; values?: RelatedValue[] | null }> | null;
  variants?: Array<{
    title?: string | null;
    sku?: string | null;
    barcode?: string | null;
    calculated_price?: CalculatedPrice | null;
    prices?: VariantPrice[] | null;
  }> | null;
};

function strings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function timestamp(value: string | Date | null | undefined) {
  if (!value) return 0;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionPair(option: string, value: string) {
  return JSON.stringify([option.trim(), value.trim()]);
}

function etbPrices(product: ProductSearchSource) {
  return (product.variants ?? []).flatMap((variant) => {
    const price = variant.calculated_price;
    if (price?.currency_code?.toLowerCase() === "etb" &&
      typeof price.calculated_amount === "number" &&
      Number.isFinite(price.calculated_amount)) return [price.calculated_amount];
    return (variant.prices ?? []).flatMap((candidate) =>
      candidate.currency_code?.toLowerCase() === "etb" && typeof candidate.amount === "number" && Number.isFinite(candidate.amount)
        ? [candidate.amount]
        : [],
    );
  });
}

export const PRODUCT_SEARCH_LOCALES = ["en-ET", "am-ET"] as const;

export function toProductSearchDocument(
  product: ProductSearchSource,
  locale: (typeof PRODUCT_SEARCH_LOCALES)[number] = "en-ET",
): ProductSearchDocument {
  const prices = etbPrices(product);
  return {
    id: `${locale}:${product.id}`,
    product_id: product.id,
    locale,
    title: product.title?.trim() || product.id,
    subtitle: product.subtitle?.trim() || null,
    description: product.description?.trim() || null,
    handle: product.handle?.trim() || product.id,
    thumbnail: product.thumbnail?.trim() || null,
    status: product.status?.trim() || "draft",
    sales_channel_ids: strings((product.sales_channels ?? []).map((item) => item.id)),
    category_ids: strings((product.categories ?? []).map((item) => item.id)),
    category_names: strings((product.categories ?? []).map((item) => item.name)),
    collection_id: product.collection?.id?.trim() || null,
    collection_title: product.collection?.title?.trim() || null,
    tag_values: strings((product.tags ?? []).map((item) => item.value)),
    option_values: strings(
      (product.options ?? []).flatMap((option) =>
        (option.values ?? []).map((item) => item.value),
      ),
    ),
    option_pairs: strings(
      (product.options ?? []).flatMap((option) => {
        const title = option.title?.trim();
        if (!title) return [];
        return (option.values ?? []).flatMap((item) => {
          const value = item.value?.trim();
          return value ? [optionPair(title, value)] : [];
        });
      }),
    ),
    variant_titles: strings((product.variants ?? []).map((variant) => variant.title)),
    skus: strings((product.variants ?? []).map((variant) => variant.sku)),
    barcodes: strings((product.variants ?? []).map((variant) => variant.barcode)),
    price_min_etb: prices.length ? Math.min(...prices) : null,
    price_max_etb: prices.length ? Math.max(...prices) : null,
    created_at: timestamp(product.created_at),
    updated_at: timestamp(product.updated_at),
  };
}

export const PRODUCT_SEARCH_FIELDS = [
  "id",
  "title",
  "subtitle",
  "description",
  "handle",
  "thumbnail",
  "status",
  "created_at",
  "updated_at",
  "sales_channels.id",
  "categories.id",
  "categories.name",
  "collection.id",
  "collection.title",
  "tags.value",
  "options.title",
  "options.values.value",
  "variants.title",
  "variants.sku",
  "variants.barcode",
  "variants.calculated_price.*",
  "variants.prices.amount",
  "variants.prices.currency_code",
] as const;
