import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildVariantMatrix } from "./product-variant-matrix";

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
        { title: "Size", values: [{ label: "S" }, { label: "M" }] },
        { title: "Color", values: [{ label: "Black" }, { label: "White" }] },
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
    const options = [
      {
        id: "opt_size",
        title: "Size",
        values: [
          { id: "optval_s", label: "S" },
          { id: "optval_m", label: "M" },
        ],
      },
      {
        id: "opt_color",
        title: "Color",
        values: [{ id: "optval_black", label: "Black" }],
      },
    ];
    const initialRows = buildVariantMatrix({
      defaults: {
        currencyCode: "usd",
        priceAmount: 25,
        stockedQuantity: 5,
        skuPrefix: "TEE",
      },
      options,
      overrides: new Map(),
    });
    const key = initialRows.find((row) => row.optionValues.Size === "M")?.key;
    assert.ok(key);
    const colorOption = options[1];
    const sizeOption = options[0];
    assert.ok(colorOption);
    assert.ok(sizeOption);
    const rows = buildVariantMatrix({
      defaults: {
        currencyCode: "usd",
        priceAmount: 25,
        stockedQuantity: 5,
        skuPrefix: "TEE",
      },
      options: [colorOption, sizeOption].map((option) =>
        option.id === "opt_size"
          ? {
              ...option,
              title: "Fit",
              values: option.values.map((value) =>
                value.id === "optval_m" ? { ...value, label: "Medium" } : value,
              ),
            }
          : option,
      ),
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

  it("carries persisted identity and disabled state into generated rows", () => {
    const options = [{ id: "opt_size", title: "Size", values: [{ id: "optval_s", label: "S" }] }];
    const initial = buildVariantMatrix({
      defaults: { currencyCode: "etb", priceAmount: 100, stockedQuantity: 2, skuPrefix: "TEE" },
      options,
      overrides: new Map(),
    });
    const key = initial[0]?.key;
    assert.ok(key);

    const [row] = buildVariantMatrix({
      defaults: { currencyCode: "etb", priceAmount: 100, stockedQuantity: 2, skuPrefix: "TEE" },
      options,
      overrides: new Map([[key, { enabled: false, id: "variant_1", reservedQuantity: 3 }]]),
    });

    assert.equal(row?.enabled, false);
    assert.equal(row?.id, "variant_1");
    assert.equal(row?.reservedQuantity, 3);
  });
});
