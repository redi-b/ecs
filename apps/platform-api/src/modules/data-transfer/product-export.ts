import type { MerchantProduct } from "@ecs/contracts";

export const PRODUCT_CSV_SCHEMA_VERSION = "ecs-products-v2";
const EXPORT_PAGE_SIZE = 100;
export const MAX_PRODUCT_EXPORT_COUNT = 10_000;

type ProductPageResult =
  | {
      ok: true;
      products: MerchantProduct[];
      count: number;
      limit: number;
      offset: number;
    }
  | { ok: false; error: string; status: number };

export type ListProductsForExport = (input: {
  limit: number;
  offset: number;
  salesChannelId: string;
  stockLocationId?: string | null | undefined;
}) => Promise<ProductPageResult>;

export type ProductExportResult =
  | { ok: true; csv: string; productCount: number; rowCount: number }
  | { ok: false; error: string; status: number };

export const PRODUCT_CSV_HEADERS = [
  "schema_version",
  "product_id",
  "product_handle",
  "product_title",
  "description",
  "status",
  "collection_id",
  "category_ids",
  "variant_id",
  "variant_title",
  "sku",
  "option_values_json",
  "option_presentations_json",
  "prices_json",
  "stocked_quantity",
  "reserved_quantity",
  "incoming_quantity",
  "available_quantity",
  "thumbnail_url",
  "image_urls_json",
  "created_at",
  "updated_at",
] as const;

export const LEGACY_PRODUCT_CSV_HEADERS = PRODUCT_CSV_HEADERS.filter(
  (header) => header !== "option_presentations_json",
);

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function jsonCell(value: unknown) {
  return JSON.stringify(value ?? []);
}

function optionPresentations(product: MerchantProduct) {
  return (product.options ?? []).flatMap((option) =>
    option.values.flatMap((value) =>
      value.swatch?.source === "explicit"
        ? [
            {
              optionTitle: option.title,
              valueLabel: value.label,
              swatch: { kind: "color" as const, value: value.swatch.value },
            },
          ]
        : [],
    ),
  );
}

export function buildProductCsv(products: MerchantProduct[]) {
  const rows: unknown[][] = [];

  for (const product of products) {
    const variants = product.variants?.length ? product.variants : [null];
    for (const variant of variants) {
      rows.push([
        PRODUCT_CSV_SCHEMA_VERSION,
        product.id,
        product.handle ?? "",
        product.title ?? "",
        product.description ?? "",
        product.status ?? "",
        product.collectionId ?? "",
        jsonCell(product.categoryIds),
        variant?.id ?? "",
        variant?.title ?? "",
        variant?.sku ?? "",
        jsonCell(variant?.optionValues),
        jsonCell(optionPresentations(product)),
        jsonCell(variant?.prices),
        variant?.stock?.stockedQuantity ?? "",
        variant?.stock?.reservedQuantity ?? "",
        variant?.stock?.incomingQuantity ?? "",
        variant?.stock?.availableQuantity ?? "",
        product.thumbnail ?? "",
        jsonCell(product.images?.map((image) => image.url).filter(Boolean)),
        product.createdAt ?? "",
        product.updatedAt ?? "",
      ]);
    }
  }

  return {
    csv: `\uFEFF${[PRODUCT_CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`,
    rowCount: rows.length,
  };
}

export async function exportProductsToCsv(input: {
  listProducts: ListProductsForExport;
  salesChannelId: string;
  stockLocationId?: string | null | undefined;
}): Promise<ProductExportResult> {
  const products: MerchantProduct[] = [];
  let offset = 0;
  let expectedCount: number | null = null;

  do {
    const page = await input.listProducts({
      limit: EXPORT_PAGE_SIZE,
      offset,
      salesChannelId: input.salesChannelId,
      stockLocationId: input.stockLocationId,
    });
    if (!page.ok) return page;

    expectedCount ??= page.count;
    if (expectedCount > MAX_PRODUCT_EXPORT_COUNT) {
      return { ok: false, error: "product_export_too_large", status: 413 };
    }

    products.push(...page.products);
    offset += page.products.length;
    if (page.products.length === 0) break;
  } while (offset < (expectedCount ?? 0));

  const uniqueProducts = [...new Map(products.map((product) => [product.id, product])).values()];
  const built = buildProductCsv(uniqueProducts);
  return {
    ok: true,
    csv: built.csv,
    productCount: uniqueProducts.length,
    rowCount: built.rowCount,
  };
}

export function productExportFilename(date = new Date()) {
  return `ecs-products-${date.toISOString().replaceAll(/[-:]/g, "").slice(0, 15)}Z.csv`;
}
