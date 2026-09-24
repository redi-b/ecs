import assert from "node:assert/strict";
import test from "node:test";

import { getOptionalBodyProductOptions, getOptionalBodyProductVariants } from "./product-body.js";

test("product options accept legacy labels and structured swatches", () => {
  assert.deepEqual(
    getOptionalBodyProductOptions({
      options: [
        {
          id: " opt_color ",
          title: " Color ",
          values: [
            " Black ",
            { id: " optval_cream ", label: " Cream ", swatch: { kind: "color", value: "#FdE" } },
            { label: "Natural", swatch: null },
          ],
        },
      ],
    }),
    [
      {
        id: "opt_color",
        title: "Color",
        values: [
          { label: "Black" },
          { id: "optval_cream", label: "Cream", swatch: { kind: "color", value: "#ffddee" } },
          { label: "Natural", swatch: null },
        ],
      },
    ],
  );
});

test("product variants preserve existing IDs", () => {
  assert.deepEqual(
    getOptionalBodyProductVariants({
      variants: [
        {
          id: " variant_1 ",
          optionValues: { Size: " M " },
          priceAmount: 1200,
          currencyCode: " ETB ",
          stockedQuantity: 4,
        },
      ],
    }),
    [
      {
        id: "variant_1",
        optionValues: { Size: "M" },
        priceAmount: 1200,
        currencyCode: "etb",
        stockedQuantity: 4,
      },
    ],
  );
});
