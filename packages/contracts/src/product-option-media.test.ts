import assert from "node:assert/strict";
import test from "node:test";
import {
  merchantProductVariantWriteSchema,
  merchantProductWriteSchema,
  productColorSwatchSchema,
  productImageSwatchSchema,
  productOptionMediaBindingsSchema,
  productOptionSwatchSchema,
  productOptionValuePresentationSchema,
  productOptionValuePresentationWriteSchema,
  productOptionValueWriteSchema,
} from "./index.js";

test("productOptionSwatchSchema accepts hex color swatch", () => {
  const result = productOptionSwatchSchema.safeParse({ kind: "color", value: "#ff0000" });
  assert.equal(result.success, true);
});

test("productOptionSwatchSchema accepts image swatch with valid URL", () => {
  const result = productOptionSwatchSchema.safeParse({
    kind: "image",
    url: "https://media.ourdomain.com/s/shop_1/ast_1/swatch.webp",
  });
  assert.equal(result.success, true);
});

test("productOptionSwatchSchema rejects invalid swatches", () => {
  assert.equal(productOptionSwatchSchema.safeParse({ kind: "color", value: "red" }).success, false);
  assert.equal(
    productOptionSwatchSchema.safeParse({ kind: "image", url: "not-a-valid-url" }).success,
    false,
  );
  assert.equal(
    productOptionSwatchSchema.safeParse({ kind: "pattern", value: "#ff0000" }).success,
    false,
  );
});

test("productColorSwatchSchema and productImageSwatchSchema work standalone", () => {
  assert.equal(
    productColorSwatchSchema.safeParse({ kind: "color", value: "#123456" }).success,
    true,
  );
  assert.equal(
    productColorSwatchSchema.safeParse({
      kind: "image",
      url: "https://media.ourdomain.com/img.png",
    }).success,
    false,
  );

  assert.equal(
    productImageSwatchSchema.safeParse({
      kind: "image",
      url: "https://media.ourdomain.com/img.png",
    }).success,
    true,
  );
  assert.equal(
    productImageSwatchSchema.safeParse({ kind: "color", value: "#123456" }).success,
    false,
  );
});

test("merchantProductVariantWriteSchema accepts optional imageUrl", () => {
  const result = merchantProductVariantWriteSchema.safeParse({
    currencyCode: "ETB",
    imageUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero.webp",
    optionValues: { Color: "Red" },
    priceAmount: 1200,
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.imageUrl, "https://media.ourdomain.com/s/shop_1/ast_1/hero.webp");
  }

  const withNull = merchantProductVariantWriteSchema.safeParse({
    currencyCode: "ETB",
    imageUrl: null,
    optionValues: { Color: "Red" },
    priceAmount: 1200,
  });
  assert.equal(withNull.success, true);
  if (withNull.success) {
    assert.equal(withNull.data.imageUrl, null);
  }

  const withoutImage = merchantProductVariantWriteSchema.safeParse({
    currencyCode: "ETB",
    optionValues: { Color: "Red" },
    priceAmount: 1200,
  });
  assert.equal(withoutImage.success, true);

  const withInvalidUrl = merchantProductVariantWriteSchema.safeParse({
    currencyCode: "ETB",
    imageUrl: "not-a-url",
    optionValues: { Color: "Red" },
    priceAmount: 1200,
  });
  assert.equal(withInvalidUrl.success, false);
});

test("productOptionValueWriteSchema accepts color and image swatches", () => {
  const stringVal = productOptionValueWriteSchema.safeParse("Red");
  assert.equal(stringVal.success, true);

  const colorVal = productOptionValueWriteSchema.safeParse({
    label: "Red",
    swatch: { kind: "color", value: "#ff0000" },
  });
  assert.equal(colorVal.success, true);

  const imageVal = productOptionValueWriteSchema.safeParse({
    label: "Floral",
    swatch: { kind: "image", url: "https://media.ourdomain.com/floral.webp" },
  });
  assert.equal(imageVal.success, true);

  const nullSwatchVal = productOptionValueWriteSchema.safeParse({
    label: "Plain",
    swatch: null,
  });
  assert.equal(nullSwatchVal.success, true);
});

test("productOptionValuePresentationWriteSchema supports color and image swatches", () => {
  const colorPres = productOptionValuePresentationWriteSchema.safeParse({
    optionTitle: "Color",
    valueLabel: "Red",
    swatch: { kind: "color", value: "#ff0000" },
  });
  assert.equal(colorPres.success, true);

  const imagePres = productOptionValuePresentationWriteSchema.safeParse({
    optionTitle: "Pattern",
    valueLabel: "Floral",
    swatch: { kind: "image", url: "https://media.ourdomain.com/floral.webp" },
  });
  assert.equal(imagePres.success, true);

  const nullPres = productOptionValuePresentationWriteSchema.safeParse({
    optionTitle: "Size",
    valueLabel: "M",
    swatch: null,
  });
  assert.equal(nullPres.success, true);
});

test("productOptionValuePresentationSchema supports both color and image swatches with source", () => {
  const explicitColor = productOptionValuePresentationSchema.safeParse({
    label: "Red",
    swatch: {
      kind: "color",
      value: "#ff0000",
      source: "explicit",
    },
  });
  assert.equal(explicitColor.success, true);

  const inferredColor = productOptionValuePresentationSchema.safeParse({
    label: "Red",
    swatch: {
      kind: "color",
      value: "#ff0000",
      source: "inferred",
    },
  });
  assert.equal(inferredColor.success, true);

  const explicitImage = productOptionValuePresentationSchema.safeParse({
    label: "Floral",
    swatch: {
      kind: "image",
      url: "https://media.ourdomain.com/floral.webp",
      source: "explicit",
    },
  });
  assert.equal(explicitImage.success, true);

  const inferredImage = productOptionValuePresentationSchema.safeParse({
    label: "Floral",
    swatch: {
      kind: "image",
      url: "https://media.ourdomain.com/floral.webp",
      source: "inferred",
    },
  });
  assert.equal(inferredImage.success, true);

  const invalidSource = productOptionValuePresentationSchema.safeParse({
    label: "Floral",
    swatch: {
      kind: "image",
      url: "https://media.ourdomain.com/floral.webp",
      source: "auto",
    },
  });
  assert.equal(invalidSource.success, false);
});

test("productOptionMediaBindingsSchema validates title and mappings", () => {
  const valid = productOptionMediaBindingsSchema.safeParse({
    optionTitle: "Color",
    mappings: {
      Red: [
        "https://media.ourdomain.com/s/shop_1/ast_1/red1.webp",
        "https://media.ourdomain.com/s/shop_1/ast_2/red2.webp",
      ],
      Blue: ["https://media.ourdomain.com/s/shop_1/ast_3/blue1.webp"],
    },
  });
  assert.equal(valid.success, true);

  const emptyTitle = productOptionMediaBindingsSchema.safeParse({
    optionTitle: "",
    mappings: {},
  });
  assert.equal(emptyTitle.success, false);

  const emptyOptionValue = productOptionMediaBindingsSchema.safeParse({
    optionTitle: "Color",
    mappings: {
      "": ["https://media.ourdomain.com/img.png"],
    },
  });
  assert.equal(emptyOptionValue.success, false);

  const emptyMediaUrl = productOptionMediaBindingsSchema.safeParse({
    optionTitle: "Color",
    mappings: {
      Red: [""],
    },
  });
  assert.equal(emptyMediaUrl.success, false);
});

test("merchantProductWriteSchema accepts optional optionMediaBindings", () => {
  const withBindings = merchantProductWriteSchema.safeParse({
    title: "Sneaker",
    optionMediaBindings: {
      optionTitle: "Color",
      mappings: {
        Red: ["https://media.ourdomain.com/s/shop_1/ast_1/red.webp"],
      },
    },
  });
  assert.equal(withBindings.success, true);

  const withNull = merchantProductWriteSchema.safeParse({
    title: "Sneaker",
    optionMediaBindings: null,
  });
  assert.equal(withNull.success, true);

  const withoutBindings = merchantProductWriteSchema.safeParse({
    title: "Sneaker",
  });
  assert.equal(withoutBindings.success, true);
});
