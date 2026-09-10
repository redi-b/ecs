import type { ProductSearchDocument } from "../modules/meilisearch/types";

type RelatedValue = { id?: string | null; name?: string | null; title?: string | null; value?: string | null };
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
  options?: Array<{ values?: RelatedValue[] | null }> | null;
  variants?: Array<{
    title?: string | null;
    sku?: string | null;
    barcode?: string | null;
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

export function toProductSearchDocument(product: ProductSearchSource): ProductSearchDocument {
  return {
    id: product.id,
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
    variant_titles: strings((product.variants ?? []).map((variant) => variant.title)),
    skus: strings((product.variants ?? []).map((variant) => variant.sku)),
    barcodes: strings((product.variants ?? []).map((variant) => variant.barcode)),
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
  "options.values.value",
  "variants.title",
  "variants.sku",
  "variants.barcode",
] as const;
