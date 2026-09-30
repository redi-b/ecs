import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapCatalog, quickSaleEmptyState } from "./quick-sale-model.js";

const translate = (key: "orders.create.productFallback" | "orders.create.defaultOption") => key;

describe("Quick Sale catalog presentation", () => {
  it("preserves explicit color and image swatches for product options", () => {
    const result = mapCatalog(
      [
        {
          id: "prod_1",
          options: [
            {
              title: "Color",
              values: [{ label: "Navy", swatch: { kind: "color", value: "#123456" } }],
            },
            {
              title: "Pattern",
              values: [
                {
                  label: "Woven",
                  swatch: { kind: "image", url: "https://media.ecset.dev/woven.webp" },
                },
              ],
            },
          ],
          title: "Shirt",
          variants: [
            {
              id: "variant_1",
              optionValues: [
                { optionTitle: "Color", value: "Navy" },
                { optionTitle: "Pattern", value: "Woven" },
              ],
              title: "Navy / Woven",
            },
          ],
        },
      ],
      translate,
    );

    assert.deepEqual(result.products[0]?.variants?.[0]?.optionSwatches, {
      Color: "#123456",
      Pattern: "https://media.ecset.dev/woven.webp",
    });
  });

  it("distinguishes an empty catalog from empty search and category results", () => {
    assert.equal(quickSaleEmptyState({ categoryId: "all", query: "" }), "catalog");
    assert.equal(quickSaleEmptyState({ categoryId: "cat_1", query: "" }), "category");
    assert.equal(quickSaleEmptyState({ categoryId: "all", query: "coffee" }), "search");
  });
});
