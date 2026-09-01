import assert from "node:assert/strict";
import test from "node:test";

import { getProductWriteBody } from "./write.js";

test("sanitizes rich product descriptions at the Medusa write boundary", () => {
  const body = getProductWriteBody({
    description:
      '<h2>Details</h2><p onclick="alert(1)"><strong>Useful</strong><script>alert(1)</script></p>',
    salesChannelId: "sc_1",
    title: "Safe product",
  });

  assert.equal(body.description, "<h2>Details</h2><p><strong>Useful</strong></p>");
});

test("preserves an explicit null when clearing a product description", () => {
  const body = getProductWriteBody({
    description: null,
    productId: "prod_1",
    salesChannelId: "sc_1",
    title: "Safe product",
  });

  assert.equal(body.description, null);
});

test("writes native option labels and namespaced presentation additional data", () => {
  const body = getProductWriteBody({
    salesChannelId: "sc_1",
    priceAmount: 100,
    currencyCode: "etb",
    options: [
      {
        id: "opt_color",
        title: "Color",
        values: [
          { id: "optval_black", label: "Black", swatch: { kind: "color", value: "#111111" } },
          { label: "Natural" },
          { label: "Old custom", swatch: null },
        ],
      },
    ],
  });

  assert.deepEqual(body.options, [
    { id: "opt_color", title: "Color", values: ["Black", "Natural", "Old custom"] },
  ]);
  assert.deepEqual(body.additional_data, {
    ecs_product_option_value_presentations: {
      version: 1,
      values: [
        {
          optionId: "opt_color",
          optionTitle: "Color",
          valueId: "optval_black",
          valueLabel: "Black",
          swatch: { kind: "color", value: "#111111" },
        },
        {
          optionId: "opt_color",
          optionTitle: "Color",
          valueLabel: "Old custom",
          swatch: null,
        },
      ],
    },
  });
});

test("an option-only product update never synthesizes or rewrites variants", () => {
  const body = getProductWriteBody({
    productId: "prod_1",
    salesChannelId: "sc_1",
    priceAmount: 100,
    currencyCode: "etb",
    options: [{ title: "Color", values: [{ label: "Black" }] }],
  });

  assert.deepEqual(body.options, [{ title: "Color", values: ["Black"] }]);
  assert.equal(body.variants, undefined);
});
