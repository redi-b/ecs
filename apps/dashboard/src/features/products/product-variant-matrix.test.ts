import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildVariantMatrix, getVariantMatrixKey } from "./product-variant-matrix";

describe("product variant matrix", () => {
  it("builds variants from multiple option groups", () => {
    const rows = buildVariantMatrix({
      defaults: {
        currencyCode: "usd",
        priceAmount: 25,
        stockedQuantity: 5,
        skuPrefix: "TEE",
      },
      options: [
        { title: "Size", values: ["S", "M"] },
        { title: "Color", values: ["Black", "White"] },
      ],
      overrides: new Map(),
    });

    assert.deepEqual(
      rows.map((row) => row.optionValues),
      [
        { Size: "S", Color: "Black" },
        { Size: "S", Color: "White" },
        { Size: "M", Color: "Black" },
        { Size: "M", Color: "White" },
      ],
    );
    assert.equal(rows[0]?.priceAmount, 25);
    assert.equal(rows[0]?.currencyCode, "usd");
    assert.equal(rows[0]?.stockedQuantity, 5);
    assert.equal(rows[0]?.sku, "TEE-S-BLACK");
  });

  it("preserves row overrides by stable option key", () => {
    const key = getVariantMatrixKey({ Size: "M", Color: "Black" });
    const rows = buildVariantMatrix({
      defaults: {
        currencyCode: "usd",
        priceAmount: 25,
        stockedQuantity: 5,
        skuPrefix: "TEE",
      },
      options: [
        { title: "Size", values: ["S", "M"] },
        { title: "Color", values: ["Black"] },
      ],
      overrides: new Map([
        [
          key,
          {
            priceAmount: 31,
            sku: "CUSTOM",
            stockedQuantity: 9,
          },
        ],
      ]),
    });

    const overridden = rows.find((row) => row.key === key);

    assert.equal(overridden?.priceAmount, 31);
    assert.equal(overridden?.stockedQuantity, 9);
    assert.equal(overridden?.sku, "CUSTOM");
  });
});
