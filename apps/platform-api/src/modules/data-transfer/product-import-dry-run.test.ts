import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MerchantProduct } from "@ecs/contracts";
import { buildProductCsv, PRODUCT_CSV_HEADERS } from "./product-export.js";
import { dryRunProductImport, parseProductImportCsv } from "./product-import-dry-run.js";

const existing: MerchantProduct = {
  id: "prod_1",
  handle: "buna",
  title: "ቡና",
  description: null,
  status: "published",
  thumbnail: null,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
  variants: [
    {
      id: "var_1",
      title: "Default",
      sku: "BUNA-1",
      prices: [{ amount: 250, currencyCode: "etb" }],
    },
  ],
};

describe("product import dry run", () => {
  it("round-trips an exported UTF-8 product as a non-mutating update plan", () => {
    const result = dryRunProductImport({
      csv: buildProductCsv([existing]).csv,
      existingProducts: [existing],
    });

    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.summary, { blocked: 0, creates: 0, rows: 1, updates: 1 });
    assert.deepEqual(result.plans[0], {
      action: "update",
      handle: "buna",
      productId: "prod_1",
      row: 2,
      sku: "BUNA-1",
      variantId: "var_1",
    });
  });

  it("accepts the exact v1 export shape and upgrades it without presentations", () => {
    const presentationIndex = PRODUCT_CSV_HEADERS.indexOf("option_presentations_json");
    const rows = parseProductImportCsv(buildProductCsv([existing]).csv).map((row, index) => {
      const legacy = [...row];
      legacy.splice(presentationIndex, 1);
      if (index > 0) legacy[0] = "ecs-products-v1";
      return legacy;
    });
    const csv = `${rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\r\n")}\r\n`;

    const result = dryRunProductImport({ csv, existingProducts: [existing] });
    assert.deepEqual(result.issues, []);
    assert.equal(result.summary.updates, 1);
  });

  it("blocks unknown IDs, duplicate SKUs, malformed JSON, and invalid quantities", () => {
    const csv = buildProductCsv([
      {
        ...existing,
        id: "prod_missing",
        variants: [
          {
            id: "var_missing",
            title: "Default",
            sku: "BUNA-1",
            prices: [{ amount: 250, currencyCode: "etb" }],
            stock: {
              locationId: "sloc_1",
              stockedQuantity: -1,
              reservedQuantity: 0,
              incomingQuantity: 0,
              availableQuantity: 0,
            },
          },
        ],
      },
    ]).csv.replace('"[]","[', '"not-json","[');
    const result = dryRunProductImport({ csv, existingProducts: [existing] });

    assert.equal(result.summary.blocked, 1);
    assert.deepEqual(
      new Set(result.issues.map((issue) => issue.code)),
      new Set([
        "unknown_product_id",
        "invalid_option_values",
        "invalid_stocked_quantity",
        "sku_conflict",
      ]),
    );
  });

  it("plans a new product only when IDs are blank and handle identity is available", () => {
    const csv = buildProductCsv([
      {
        id: "",
        handle: "new-coffee",
        title: "New Coffee",
        status: "draft",
        thumbnail: null,
        createdAt: null,
        updatedAt: null,
        variants: [
          {
            id: "",
            title: "Default",
            sku: "NEW-1",
            prices: [{ amount: 100, currencyCode: "etb" }],
          },
        ],
      },
    ]).csv;
    const result = dryRunProductImport({ csv, existingProducts: [existing] });
    assert.deepEqual(result.summary, { blocked: 0, creates: 1, rows: 1, updates: 0 });
  });
});
