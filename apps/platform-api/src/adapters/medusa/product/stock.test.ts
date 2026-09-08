import assert from "node:assert/strict";
import test from "node:test";

import { findRequestedVariant } from "./stock.js";

test("matches a requested stock row by persisted variant ID", () => {
  const requested = findRequestedVariant({ id: "variant_1", options: [] }, [
    {
      id: "variant_1",
      optionValues: { Size: "M" },
      priceAmount: 1200,
      currencyCode: "etb",
      stockedQuantity: 7,
    },
  ]);

  assert.equal(requested?.stockedQuantity, 7);
});

test("matches a newly created variant by its exact option values", () => {
  const requested = findRequestedVariant(
    {
      id: "variant_generated",
      options: [
        { value: "M", option: { title: "Size" } },
        { value: "Black", option: { title: "Color" } },
      ],
    },
    [
      {
        optionValues: { Color: "Black", Size: "M" },
        priceAmount: 1200,
        currencyCode: "etb",
        stockedQuantity: 9,
      },
    ],
  );

  assert.equal(requested?.stockedQuantity, 9);
});

test("does not match a partial option combination", () => {
  const requested = findRequestedVariant(
    {
      options: [
        { value: "M", option: { title: "Size" } },
        { value: "Black", option: { title: "Color" } },
      ],
    },
    [
      {
        optionValues: { Size: "M" },
        priceAmount: 1200,
        currencyCode: "etb",
        stockedQuantity: 9,
      },
    ],
  );

  assert.equal(requested, undefined);
});
