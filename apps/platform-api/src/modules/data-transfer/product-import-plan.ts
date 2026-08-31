import type { MerchantProduct } from "@ecs/contracts";

import { PRODUCT_CSV_HEADERS } from "./product-export.js";
import {
  dryRunProductImport,
  normalizeProductImportCsvRows,
  type ProductImportIssue,
  parseProductImportCsv,
} from "./product-import-dry-run.js";

export type ProductImportVariantWrite = {
  currencyPrices: Array<{ amount: number; currencyCode: string }>;
  id: string | null;
  optionValues: Record<string, string>;
  row: number;
  sku: string | null;
  stockedQuantity: number | null;
  title: string | null;
};

export type ProductImportWrite = {
  action: "create" | "update";
  categoryIds: string[];
  collectionId: string | null;
  description: string | null;
  handle: string;
  imageUrls: string[];
  optionPresentations?: Array<{
    optionTitle: string;
    valueLabel: string;
    swatch: { kind: "color"; value: string };
  }>;
  productId: string | null;
  sourceRows: number[];
  status: string | null;
  thumbnail: string | null;
  title: string;
  variants: ProductImportVariantWrite[];
};

export type ProductImportWritePlan =
  | { ok: true; writes: ProductImportWrite[] }
  | { ok: false; issues: ProductImportIssue[] };

type ProductFields = Omit<ProductImportWrite, "action" | "productId" | "sourceRows" | "variants">;

function cell(cells: string[], name: (typeof PRODUCT_CSV_HEADERS)[number]) {
  const value = cells[PRODUCT_CSV_HEADERS.indexOf(name)]?.trim() ?? "";
  return value.startsWith("'") && /^[=+\-@]/.test(value.slice(1)) ? value.slice(1) : value;
}

function json<T>(value: string): T {
  return JSON.parse(value || "[]") as T;
}

function optionValueMap(value: string) {
  return Object.fromEntries(
    json<Array<{ optionTitle: string | null; value: string | null }>>(value).flatMap((option) =>
      option.optionTitle && option.value ? [[option.optionTitle, option.value] as const] : [],
    ),
  );
}

function productFields(cells: string[]): ProductFields {
  return {
    categoryIds: json<string[]>(cell(cells, "category_ids")),
    collectionId: cell(cells, "collection_id") || null,
    description: cell(cells, "description") || null,
    handle: cell(cells, "product_handle"),
    imageUrls: json<string[]>(cell(cells, "image_urls_json")),
    optionPresentations: json<NonNullable<ProductImportWrite["optionPresentations"]>>(
      cell(cells, "option_presentations_json"),
    ),
    status: cell(cells, "status") || null,
    thumbnail: cell(cells, "thumbnail_url") || null,
    title: cell(cells, "product_title"),
  };
}

function stableProductFields(value: ProductFields) {
  return JSON.stringify({
    ...value,
    categoryIds: [...value.categoryIds].sort(),
    imageUrls: [...value.imageUrls].sort(),
  });
}

/** Builds the immutable, deterministic product-level write contract after validation. */
export function buildProductImportWritePlan(input: {
  csv: string;
  existingProducts: MerchantProduct[];
}): ProductImportWritePlan {
  const dryRun = dryRunProductImport(input);
  if (dryRun.issues.length > 0) return { ok: false, issues: dryRun.issues };

  const rows = normalizeProductImportCsvRows(parseProductImportCsv(input.csv)).slice(1);
  const groups = new Map<
    string,
    { fields: ProductFields; rows: string[][]; sourceRows: number[] }
  >();
  const issues: ProductImportIssue[] = [];

  rows.forEach((cells, index) => {
    const row = index + 2;
    const productId = cell(cells, "product_id");
    const handle = cell(cells, "product_handle").toLowerCase();
    const key = productId ? `update:${productId}` : `create:${handle}`;
    const fields = productFields(cells);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { fields, rows: [cells], sourceRows: [row] });
      return;
    }
    if (stableProductFields(group.fields) !== stableProductFields(fields)) {
      issues.push({
        code: "conflicting_product_fields",
        message: `Product fields conflict with row ${group.sourceRows[0]}.`,
        row,
      });
      return;
    }
    group.rows.push(cells);
    group.sourceRows.push(row);
  });

  if (issues.length > 0) return { ok: false, issues };

  const writes = [...groups.values()].map((group): ProductImportWrite => {
    const productId = cell(group.rows[0] ?? [], "product_id") || null;
    return {
      action: productId ? "update" : "create",
      ...group.fields,
      productId,
      sourceRows: group.sourceRows,
      variants: group.rows.map((cells, index) => ({
        currencyPrices: json<Array<{ amount: number; currencyCode: string }>>(
          cell(cells, "prices_json"),
        ).map((price) => ({
          amount: price.amount,
          currencyCode: price.currencyCode.toLowerCase(),
        })),
        id: cell(cells, "variant_id") || null,
        optionValues: optionValueMap(cell(cells, "option_values_json")),
        row: group.sourceRows[index] ?? 0,
        sku: cell(cells, "sku") || null,
        stockedQuantity: cell(cells, "stocked_quantity")
          ? Number(cell(cells, "stocked_quantity"))
          : null,
        title: cell(cells, "variant_title") || null,
      })),
    };
  });

  return { ok: true, writes };
}
