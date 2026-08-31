import type { MerchantProduct } from "@ecs/contracts";
import type { ListProductsForExport } from "./product-export.js";
import {
  LEGACY_PRODUCT_CSV_HEADERS,
  PRODUCT_CSV_HEADERS,
  PRODUCT_CSV_SCHEMA_VERSION,
} from "./product-export.js";

export const MAX_PRODUCT_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_PRODUCT_IMPORT_ROWS = 10_000;

export type ProductImportIssue = { code: string; message: string; row: number };
export type ProductImportPlanRow = {
  action: "create" | "update" | "blocked";
  handle: string | null;
  productId: string | null;
  row: number;
  sku: string | null;
  variantId: string | null;
};
export type ProductImportDryRun = {
  issues: ProductImportIssue[];
  plans: ProductImportPlanRow[];
  summary: { blocked: number; creates: number; rows: number; updates: number };
};

export async function loadExistingProductsForImport(input: {
  listProducts: ListProductsForExport;
  salesChannelId: string;
}): Promise<
  { ok: true; products: MerchantProduct[] } | { ok: false; error: string; status: number }
> {
  const products: MerchantProduct[] = [];
  let offset = 0;
  let count: number | null = null;
  do {
    const page = await input.listProducts({
      limit: 100,
      offset,
      salesChannelId: input.salesChannelId,
    });
    if (!page.ok) return page;
    count ??= page.count;
    if (count > MAX_PRODUCT_IMPORT_ROWS) {
      return { ok: false, error: "product_import_catalog_too_large", status: 413 };
    }
    products.push(...page.products);
    offset += page.products.length;
    if (page.products.length === 0) break;
  } while (offset < (count ?? 0));
  return {
    ok: true,
    products: [...new Map(products.map((product) => [product.id, product])).values()],
  };
}

export function parseProductImportCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("unterminated_csv_quote");
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

/** Upgrades the exact v1 shape in memory; malformed or modified headers remain untouched. */
export function normalizeProductImportCsvRows(rows: string[][]): string[][] {
  const headers = rows[0] ?? [];
  const isLegacy =
    headers.length === LEGACY_PRODUCT_CSV_HEADERS.length &&
    LEGACY_PRODUCT_CSV_HEADERS.every((header, index) => headers[index] === header);
  if (!isLegacy) return rows;

  const presentationIndex = PRODUCT_CSV_HEADERS.indexOf("option_presentations_json");
  return rows.map((row, index) => {
    const upgraded = [...row];
    upgraded.splice(presentationIndex, 0, index === 0 ? "option_presentations_json" : "[]");
    if (index > 0 && upgraded[0] === "ecs-products-v1") upgraded[0] = PRODUCT_CSV_SCHEMA_VERSION;
    return upgraded;
  });
}

function parseJsonArray(value: string, code: string, row: number, issues: ProductImportIssue[]) {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) throw new Error(code);
    return parsed as unknown[];
  } catch {
    issues.push({ code, message: `${code} must be a JSON array.`, row });
    return null;
  }
}

function normalizedCell(value: string) {
  return value.startsWith("'") && /^[=+\-@]/.test(value.slice(1)) ? value.slice(1) : value;
}

export function dryRunProductImport(input: {
  csv: string;
  existingProducts: MerchantProduct[];
}): ProductImportDryRun {
  const issues: ProductImportIssue[] = [];
  let rows: string[][];
  try {
    rows = normalizeProductImportCsvRows(parseProductImportCsv(input.csv));
  } catch (error) {
    return {
      issues: [{ code: "invalid_csv", message: String((error as Error).message), row: 1 }],
      plans: [],
      summary: { blocked: 0, creates: 0, rows: 0, updates: 0 },
    };
  }
  if (rows.length === 0) {
    return {
      issues: [{ code: "empty_csv", message: "The CSV has no header row.", row: 1 }],
      plans: [],
      summary: { blocked: 0, creates: 0, rows: 0, updates: 0 },
    };
  }
  const headers = rows[0] ?? [];
  if (
    headers.length !== PRODUCT_CSV_HEADERS.length ||
    PRODUCT_CSV_HEADERS.some((header, index) => headers[index] !== header)
  ) {
    return {
      issues: [
        {
          code: "invalid_product_csv_headers",
          message: `Use the ${PRODUCT_CSV_SCHEMA_VERSION} template without changing its columns.`,
          row: 1,
        },
      ],
      plans: [],
      summary: { blocked: 0, creates: 0, rows: Math.max(0, rows.length - 1), updates: 0 },
    };
  }
  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_PRODUCT_IMPORT_ROWS) {
    return {
      issues: [
        {
          code: "product_import_too_large",
          message: `At most ${MAX_PRODUCT_IMPORT_ROWS} rows are allowed.`,
          row: 1,
        },
      ],
      plans: [],
      summary: { blocked: dataRows.length, creates: 0, rows: dataRows.length, updates: 0 },
    };
  }

  const existingById = new Map(input.existingProducts.map((product) => [product.id, product]));
  const existingByHandle = new Map(
    input.existingProducts.flatMap((product) =>
      product.handle ? [[product.handle.toLowerCase(), product] as const] : [],
    ),
  );
  const existingSkuOwner = new Map<string, { productId: string; variantId: string }>();
  for (const product of input.existingProducts) {
    for (const variant of product.variants ?? []) {
      if (variant.sku) {
        existingSkuOwner.set(variant.sku.toLowerCase(), {
          productId: product.id,
          variantId: variant.id,
        });
      }
    }
  }

  const plans: ProductImportPlanRow[] = [];
  const seenIdentity = new Map<string, number>();
  const seenSku = new Map<string, number>();
  dataRows.forEach((cells, rowIndex) => {
    const row = rowIndex + 2;
    const value = (name: (typeof PRODUCT_CSV_HEADERS)[number]) =>
      normalizedCell(cells[PRODUCT_CSV_HEADERS.indexOf(name)]?.trim() ?? "");
    const schema = value("schema_version");
    const productId = value("product_id");
    const handle = value("product_handle");
    const title = value("product_title");
    const variantId = value("variant_id");
    const sku = value("sku");
    const rowIssuesBefore = issues.length;

    if (cells.length !== PRODUCT_CSV_HEADERS.length) {
      issues.push({
        code: "invalid_column_count",
        message: "The row has the wrong number of columns.",
        row,
      });
    }
    if (schema !== PRODUCT_CSV_SCHEMA_VERSION) {
      issues.push({
        code: "unsupported_schema_version",
        message: `Expected ${PRODUCT_CSV_SCHEMA_VERSION}.`,
        row,
      });
    }
    if (!title)
      issues.push({ code: "missing_product_title", message: "Product title is required.", row });

    const existing = productId ? existingById.get(productId) : undefined;
    let action: ProductImportPlanRow["action"] = productId ? "update" : "create";
    if (productId && !existing) {
      issues.push({
        code: "unknown_product_id",
        message: "The product ID is not in this merchant catalog.",
        row,
      });
    }
    if (!productId && !handle) {
      issues.push({
        code: "missing_product_handle",
        message: "New products require a handle.",
        row,
      });
    }
    if (!productId && handle && existingByHandle.has(handle.toLowerCase())) {
      issues.push({
        code: "product_handle_conflict",
        message: "This handle already belongs to an existing product.",
        row,
      });
    }
    if (
      existing &&
      variantId &&
      !(existing.variants ?? []).some((variant) => variant.id === variantId)
    ) {
      issues.push({
        code: "unknown_variant_id",
        message: "The variant ID does not belong to this product.",
        row,
      });
    }
    if (existing && !variantId) {
      issues.push({
        code: "missing_variant_id",
        message: "Updating an existing product requires its variant ID.",
        row,
      });
    }

    const identity = `${productId || `new:${handle.toLowerCase()}`}:${variantId || `new:${sku.toLowerCase() || row}`}`;
    const previousIdentityRow = seenIdentity.get(identity);
    if (previousIdentityRow) {
      issues.push({
        code: "duplicate_import_row",
        message: `Duplicates row ${previousIdentityRow}.`,
        row,
      });
    } else seenIdentity.set(identity, row);

    parseJsonArray(value("category_ids"), "invalid_category_ids", row, issues);
    parseJsonArray(value("image_urls_json"), "invalid_image_urls", row, issues);
    const optionValues = parseJsonArray(
      value("option_values_json"),
      "invalid_option_values",
      row,
      issues,
    );
    if (
      optionValues?.some(
        (option) =>
          typeof option !== "object" ||
          option === null ||
          typeof (option as { optionTitle?: unknown }).optionTitle !== "string" ||
          typeof (option as { value?: unknown }).value !== "string",
      )
    ) {
      issues.push({
        code: "invalid_option_values",
        message: "Every option value needs optionTitle and value strings.",
        row,
      });
    }
    const optionPresentations = parseJsonArray(
      value("option_presentations_json"),
      "invalid_option_presentations",
      row,
      issues,
    );
    if (
      optionPresentations?.some((presentation) => {
        if (typeof presentation !== "object" || presentation === null) return true;
        const candidate = presentation as {
          optionTitle?: unknown;
          valueLabel?: unknown;
          swatch?: { kind?: unknown; value?: unknown };
        };
        return (
          typeof candidate.optionTitle !== "string" ||
          typeof candidate.valueLabel !== "string" ||
          candidate.swatch?.kind !== "color" ||
          typeof candidate.swatch.value !== "string" ||
          !/^#[0-9a-f]{6}$/i.test(candidate.swatch.value)
        );
      })
    ) {
      issues.push({
        code: "invalid_option_presentations",
        message:
          "Every option presentation needs optionTitle, valueLabel, and a #RRGGBB color swatch.",
        row,
      });
    }
    const prices = parseJsonArray(value("prices_json"), "invalid_prices", row, issues);
    if (
      prices?.some(
        (price) =>
          typeof price !== "object" ||
          price === null ||
          typeof (price as { amount?: unknown }).amount !== "number" ||
          (price as { amount: number }).amount < 0 ||
          typeof (price as { currencyCode?: unknown }).currencyCode !== "string",
      )
    ) {
      issues.push({
        code: "invalid_prices",
        message: "Every price needs a non-negative amount and currencyCode.",
        row,
      });
    }
    const stocked = value("stocked_quantity");
    if (stocked && (!/^\d+$/.test(stocked) || Number(stocked) > 1_000_000_000)) {
      issues.push({
        code: "invalid_stocked_quantity",
        message: "Stocked quantity must be a whole number from 0 to 1,000,000,000.",
        row,
      });
    }
    if (sku) {
      const normalizedSku = sku.toLowerCase();
      const priorSkuRow = seenSku.get(normalizedSku);
      const owner = existingSkuOwner.get(normalizedSku);
      if (priorSkuRow)
        issues.push({ code: "duplicate_sku", message: `SKU duplicates row ${priorSkuRow}.`, row });
      else seenSku.set(normalizedSku, row);
      if (owner && (owner.productId !== productId || owner.variantId !== variantId)) {
        issues.push({
          code: "sku_conflict",
          message: "SKU belongs to another existing variant.",
          row,
        });
      }
    }

    if (issues.length > rowIssuesBefore) action = "blocked";
    plans.push({
      action,
      handle: handle || null,
      productId: productId || null,
      row,
      sku: sku || null,
      variantId: variantId || null,
    });
  });

  return {
    issues,
    plans,
    summary: {
      blocked: plans.filter((plan) => plan.action === "blocked").length,
      creates: plans.filter((plan) => plan.action === "create").length,
      rows: plans.length,
      updates: plans.filter((plan) => plan.action === "update").length,
    },
  };
}
