import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MerchantProduct } from "@ecs/contracts";

import {
  getProductDefaultValues,
  getProductVariantsPayload,
  getRemovedExistingVariants,
  suggestAvailableProductHandle,
  validateProductVariantConfiguration,
} from "./product-form-state";

const product: MerchantProduct = {
  id: "prod_1",
  title: "T-shirt",
  handle: "t-shirt",
  status: "published",
  thumbnail: null,
  description: null,
  collectionId: null,
  categoryIds: [],
  images: [],
  options: [
    {
      id: "opt_size",
      title: "Size",
      values: [
        { id: "optval_s", label: "S" },
        { id: "optval_m", label: "M" },
      ],
    },
  ],
  variants: [
    {
      id: "variant_s",
      title: "S",
      sku: "TEE-S",
      optionValues: [{ optionTitle: "Size", value: "S" }],
      prices: [{ amount: 1000, currencyCode: "etb" }],
      stock: {
        locationId: "sloc_1",
        stockedQuantity: 5,
        reservedQuantity: 0,
        incomingQuantity: 0,
        availableQuantity: 5,
      },
    },
    {
      id: "variant_m",
      title: "M",
      sku: "TEE-M",
      optionValues: [{ optionTitle: "Size", value: "M" }],
      prices: [{ amount: 1200, currencyCode: "etb" }],
      stock: {
        locationId: "sloc_1",
        stockedQuantity: 3,
        reservedQuantity: 1,
        incomingQuantity: 0,
        availableQuantity: 2,
      },
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const t = (key: string) => key;

describe("product handle conflict suggestions", () => {
  it("adds a safe numeric suffix to a product handle", () => {
    assert.equal(suggestAvailableProductHandle("coffee-beans"), "coffee-beans-2");
  });

  it("increments an existing numeric suffix", () => {
    assert.equal(suggestAvailableProductHandle("coffee-beans-2"), "coffee-beans-3");
  });

  it("provides a valid fallback when the handle is empty", () => {
    assert.equal(suggestAvailableProductHandle(""), "product-2");
  });
});

describe("product variant edit state", () => {
  it("hydrates variant IDs, prices, SKUs, and location stock", () => {
    const values = getProductDefaultValues(product);
    const variants = getProductVariantsPayload(values);

    assert.deepEqual(
      variants.map((variant) => ({
        id: variant.id,
        priceAmount: variant.priceAmount,
        sku: variant.sku,
        stockedQuantity: variant.stockedQuantity,
      })),
      [
        { id: "variant_s", priceAmount: 1000, sku: "TEE-S", stockedQuantity: 5 },
        { id: "variant_m", priceAmount: 1200, sku: "TEE-M", stockedQuantity: 3 },
      ],
    );
  });

  it("preserves variant identity when an option label changes", () => {
    const values = getProductDefaultValues(product);
    const option = values.options[0];
    const mediumValue = option?.values[1];
    assert.ok(option);
    assert.ok(mediumValue);
    option.title = "Fit";
    mediumValue.label = "Medium";

    const medium = getProductVariantsPayload(values).find((variant) => variant.id === "variant_m");

    assert.deepEqual(medium?.optionValues, { Fit: "Medium" });
  });

  it("omits disabled variants and exposes them for explicit removal review", () => {
    const values = getProductDefaultValues(product);
    const mediumKey = Object.entries(values.variantOverrides).find(
      ([, override]) => override.id === "variant_m",
    )?.[0];
    assert.ok(mediumKey);
    values.variantOverrides[mediumKey] = {
      ...values.variantOverrides[mediumKey],
      enabled: false,
      reservedQuantity: 0,
    };

    assert.deepEqual(
      getProductVariantsPayload(values).map((variant) => variant.id),
      ["variant_s"],
    );
    assert.deepEqual(getRemovedExistingVariants(values), [
      { id: "variant_m", key: mediumKey, reservedQuantity: 0 },
    ]);
  });

  it("blocks removal of a variant with reserved stock", () => {
    const values = getProductDefaultValues(product);
    const mediumKey = Object.entries(values.variantOverrides).find(
      ([, override]) => override.id === "variant_m",
    )?.[0];
    assert.ok(mediumKey);
    values.variantOverrides[mediumKey] = {
      ...values.variantOverrides[mediumKey],
      enabled: false,
    };

    assert.throws(
      () => validateProductVariantConfiguration(values, t as never),
      /products\.validation\.variantReserved/,
    );
  });
});
