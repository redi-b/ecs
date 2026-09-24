import assert from "node:assert/strict";
import test from "node:test";

import {
  completeVariantOptionsForCurrentProduct,
  getProductOptionBatchBody,
  getProductWriteBody,
  splitProductOptionBatchBody,
} from "./write.js";
test("variant updates retain unrelated Medusa metadata", () => {
  const completed = completeVariantOptionsForCurrentProduct(
    {
      variants: [
        {
          id: "variant_red",
          metadata: { fulfillment_code: "aisle-3", image_source: "option" },
          options: [{ value: "Red", option: { title: "Color" } }],
        },
      ],
    },
    [
      {
        id: "variant_red",
        currencyCode: "etb",
        optionValues: { Color: "Red" },
        priceAmount: 100,
        imageUrl: "https://example.com/new.jpg",
        imageSource: "option",
      },
    ],
  );
  assert.equal(completed?.[0]?.metadata?.fulfillment_code, "aisle-3");
  assert.equal(completed?.[0]?.metadata?.image_source, "option");
});

test("keeps existing option assignments until retired axes are removed", () => {
  const variants = completeVariantOptionsForCurrentProduct(
    {
      options: [
        {
          id: "opt_default",
          title: "Default",
          values: [{ id: "value_default", value: "Default" }],
        },
        {
          id: "opt_tier",
          title: "Tier",
          values: [
            { id: "value_classic", value: "Classic" },
            { id: "value_premium", value: "Premium" },
          ],
        },
      ],
      variants: [
        {
          id: "variant_classic",
          options: [
            { value: "Default", option: { title: "Default" } },
            { value: "Classic", option: { title: "Tier" } },
          ],
        },
      ],
    },
    [
      {
        id: "variant_classic",
        currencyCode: "etb",
        optionValues: { Tier: "Classic" },
        priceAmount: 100,
      },
      {
        currencyCode: "etb",
        optionValues: { Tier: "Gold" },
        priceAmount: 120,
      },
    ],
  );

  assert.deepEqual(variants?.[0]?.optionValues, {
    Default: "Default",
    Tier: "Classic",
  });
  assert.deepEqual(variants?.[1]?.optionValues, {
    Default: "Default",
    Tier: "Gold",
  });
});

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
  const input = {
    productId: "prod_1",
    salesChannelId: "sc_1",
    priceAmount: 100,
    currencyCode: "etb",
    options: [
      {
        id: "opt_color",
        title: "Color",
        values: [{ id: "optval_black", label: "Black" }, { label: "Natural" }],
      },
    ],
  };
  const body = getProductWriteBody(input);
  const optionBatch = getProductOptionBatchBody(
    {
      options: [
        {
          id: "opt_color",
          title: "Color",
          values: [{ id: "optval_black", value: "Black" }],
        },
      ],
    },
    input.options,
  );

  assert.equal(body.options, undefined);
  assert.equal(body.variants, undefined);
  assert.deepEqual(optionBatch, {
    update: [{ product_option_id: "opt_color", add: [{ value: "Natural" }] }],
  });
});

test("option changes are ordered around the variant update", () => {
  assert.deepEqual(
    splitProductOptionBatchBody({
      add: [{ title: "Material", values: ["Cotton"] }],
      remove: ["opt_old"],
      update: [
        {
          product_option_id: "opt_color",
          add: [{ value: "Natural" }],
          remove: ["optval_black"],
        },
      ],
    }),
    {
      beforeProductUpdate: {
        add: [{ title: "Material", values: ["Cotton"] }],
        update: [{ product_option_id: "opt_color", add: [{ value: "Natural" }] }],
      },
      afterProductUpdate: {
        remove: ["opt_old"],
        update: [{ product_option_id: "opt_color", remove: ["optval_black"] }],
      },
    },
  );
});

test("reuses an existing option axis by title when the editor omits its Medusa ID", () => {
  const batch = getProductOptionBatchBody(
    {
      options: [
        {
          id: "opt_tier",
          title: "Tier",
          values: [
            { id: "value_classic", value: "Classic" },
            { id: "value_premium", value: "Premium" },
          ],
        },
      ],
    },
    [{ title: "Tier", values: ["Classic", "Premium", "Gold"] }],
  );

  assert.deepEqual(batch, {
    update: [{ product_option_id: "opt_tier", add: [{ value: "Gold" }] }],
  });
});

test("repairs duplicate option axes before variants are updated", () => {
  const batch = getProductOptionBatchBody(
    {
      options: [
        {
          id: "opt_tier_original",
          title: "Tier",
          values: [
            { id: "value_classic", value: "Classic" },
            { id: "value_premium", value: "Premium" },
          ],
        },
        {
          id: "opt_tier_duplicate",
          title: "Tier",
          values: [
            { id: "value_classic_2", value: "Classic" },
            { id: "value_premium_2", value: "Premium" },
            { id: "value_gold", value: "Gold" },
          ],
        },
      ],
    },
    [{ title: "Tier", values: ["Classic", "Premium", "Gold"] }],
  );

  assert.deepEqual(splitProductOptionBatchBody(batch), {
    beforeProductUpdate: {
      remove: ["opt_tier_duplicate"],
      update: [{ product_option_id: "opt_tier_original", add: [{ value: "Gold" }] }],
    },
    afterProductUpdate: null,
  });
});

test("preserves existing variant IDs in product updates", () => {
  const body = getProductWriteBody({
    productId: "prod_1",
    salesChannelId: "sc_1",
    regionId: "reg_1",
    options: [{ id: "opt_size", title: "Size", values: [{ label: "M" }] }],
    variants: [
      {
        id: "variant_1",
        optionValues: { Size: "M" },
        sku: "TEE-M",
        priceAmount: 1200,
        currencyCode: "etb",
        stockedQuantity: 4,
      },
    ],
  });

  assert.deepEqual(body.variants, [
    {
      id: "variant_1",
      title: "M",
      sku: "TEE-M",
      manage_inventory: true,
      options: { Size: "M" },
      prices: [{ amount: 1200, currency_code: "etb", rules: { region_id: "reg_1" } }],
    },
  ]);
});

test("clearing the gallery and cover persists explicit empty media without variant writes", () => {
  const body = getProductWriteBody({
    productId: "prod_1",
    salesChannelId: "sc_1",
    thumbnail: null,
    imageUrls: [],
    optionMediaBindings: null,
  });
  assert.equal(body.thumbnail, null);
  assert.deepEqual(body.images, []);
  assert.equal("variants" in body, false);
});
