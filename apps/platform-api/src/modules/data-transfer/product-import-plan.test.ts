import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MerchantProduct } from "@ecs/contracts";

import { buildProductCsv } from "./product-export.js";
import { buildProductImportWritePlan } from "./product-import-plan.js";

const existing: MerchantProduct = {
  id: "prod_1",
  handle: "buna",
  title: "ቡና",
  description: "Roasted in Addis Ababa",
  status: "published",
  thumbnail: "https://cdn.example/buna.jpg",
  categoryIds: ["pcat_1"],
  images: [
    {
      id: "img_1",
      url: "https://cdn.example/detail.jpg",
      rank: 0,
      createdAt: null,
      updatedAt: null,
    },
  ],
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
  variants: [
    {
      id: "var_1",
      title: "250g",
      sku: "BUNA-250",
      optionValues: [{ optionTitle: "Size", value: "250g" }],
      prices: [
        { amount: 250, currencyCode: "etb" },
        { amount: 2, currencyCode: "usd" },
      ],
      stock: {
        locationId: "sloc_1",
        stockedQuantity: 12,
        reservedQuantity: 0,
        incomingQuantity: 0,
        availableQuantity: 12,
      },
    },
    {
      id: "var_2",
      title: "500g",
      sku: "BUNA-500",
      optionValues: [{ optionTitle: "Size", value: "500g" }],
      prices: [{ amount: 450, currencyCode: "etb" }],
      stock: {
        locationId: "sloc_1",
        stockedQuantity: 8,
        reservedQuantity: 0,
        incomingQuantity: 0,
        availableQuantity: 8,
      },
    },
  ],
};

describe("product import grouped write plan", () => {
  it("round-trips all variants, identities, prices, media, and stock into one update", () => {
    const result = buildProductImportWritePlan({
      csv: buildProductCsv([existing]).csv,
      existingProducts: [existing],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.writes.length, 1);
    assert.deepEqual(result.writes[0], {
      action: "update",
      categoryIds: ["pcat_1"],
      collectionId: null,
      description: "Roasted in Addis Ababa",
      handle: "buna",
      imageUrls: ["https://cdn.example/detail.jpg"],
      productId: "prod_1",
      sourceRows: [2, 3],
      status: "published",
      thumbnail: "https://cdn.example/buna.jpg",
      title: "ቡና",
      variants: [
        {
          currencyPrices: [
            { amount: 250, currencyCode: "etb" },
            { amount: 2, currencyCode: "usd" },
          ],
          id: "var_1",
          optionValues: { Size: "250g" },
          row: 2,
          sku: "BUNA-250",
          stockedQuantity: 12,
          title: "250g",
        },
        {
          currencyPrices: [{ amount: 450, currencyCode: "etb" }],
          id: "var_2",
          optionValues: { Size: "500g" },
          row: 3,
          sku: "BUNA-500",
          stockedQuantity: 8,
          title: "500g",
        },
      ],
    });
  });

  it("rejects conflicting product fields across rows in the same product", () => {
    const csv = buildProductCsv([existing]).csv.replace(
      '"prod_1","buna","ቡና","Roasted in Addis Ababa"',
      '"prod_1","buna","Different title","Roasted in Addis Ababa"',
    );
    const result = buildProductImportWritePlan({ csv, existingProducts: [existing] });
    assert.deepEqual(result, {
      ok: false,
      issues: [
        {
          code: "conflicting_product_fields",
          message: "Product fields conflict with row 2.",
          row: 3,
        },
      ],
    });
  });
});
