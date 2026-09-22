import test from "node:test";
import assert from "node:assert/strict";
import { getProductWriteBody, getProductVariantWriteBody } from "./write.js";
import { normalizeProduct, getExplicitColorSwatch, getExplicitSwatch } from "./normalize.js";

test("getProductWriteBody preserves option_media_bindings in metadata", () => {
  const body = getProductWriteBody({
    optionMediaBindings: {
      mappings: { Red: ["https://media.ourdomain.com/red.png"] },
      optionTitle: "Color",
    },
    title: "Sneaker",
  } as any);
  assert.deepEqual((body.metadata as any)?.option_media_bindings, {
    mappings: { Red: ["https://media.ourdomain.com/red.png"] },
    optionTitle: "Color",
  });
});

test("getProductVariantWriteBody persists imageUrl in metadata", () => {
  const body = getProductVariantWriteBody(
    {
      currencyCode: "ETB",
      imageUrl: "https://media.ourdomain.com/s/shop_1/ast_1/red.webp",
      optionValues: { Color: "Red" },
      priceAmount: 1200,
    } as any,
    undefined,
  );
  assert.deepEqual((body as any).metadata?.image_url, "https://media.ourdomain.com/s/shop_1/ast_1/red.webp");
});

test("normalizeProduct extracts optionMediaBindings from metadata", () => {
  const normalized = normalizeProduct({
    id: "prod_1",
    title: "Sneaker",
    metadata: {
      option_media_bindings: {
        optionTitle: "Color",
        mappings: {
          Red: ["https://media.ourdomain.com/red.png"],
        },
      },
    },
  });
  assert.equal(normalized.length, 1);
  assert.deepEqual(normalized[0]?.optionMediaBindings, {
    optionTitle: "Color",
    mappings: {
      Red: ["https://media.ourdomain.com/red.png"],
    },
  });
});

test("normalizeProduct safely handles null or missing optionMediaBindings", () => {
  const normalizedWithout = normalizeProduct({
    id: "prod_1",
    title: "Sneaker",
  });
  assert.equal(normalizedWithout[0]?.optionMediaBindings, undefined);

  const normalizedWithNull = normalizeProduct({
    id: "prod_2",
    title: "Sneaker 2",
    metadata: {
      option_media_bindings: null,
    },
  });
  assert.equal(normalizedWithNull[0]?.optionMediaBindings, null);
});

test("normalizeProduct extracts variant imageUrl from variant metadata and fallbacks", () => {
  const normalized = normalizeProduct({
    id: "prod_1",
    title: "Sneaker",
    variants: [
      {
        id: "var_1",
        title: "Red",
        prices: [{ amount: 100, currency_code: "etb" }],
        metadata: {
          image_url: "https://media.ourdomain.com/red.png",
        },
      },
      {
        id: "var_2",
        title: "Blue",
        prices: [{ amount: 100, currency_code: "etb" }],
        image_url: "https://media.ourdomain.com/blue.png",
      },
      {
        id: "var_3",
        title: "Green",
        prices: [{ amount: 100, currency_code: "etb" }],
        thumbnail: "https://media.ourdomain.com/green.png",
      },
      {
        id: "var_4",
        title: "Plain",
        prices: [{ amount: 100, currency_code: "etb" }],
      },
    ],
  });

  const variants = normalized[0]?.variants ?? [];
  assert.equal(variants[0]?.imageUrl, "https://media.ourdomain.com/red.png");
  assert.equal(variants[1]?.imageUrl, "https://media.ourdomain.com/blue.png");
  assert.equal(variants[2]?.imageUrl, "https://media.ourdomain.com/green.png");
  assert.equal(variants[3]?.imageUrl, undefined);
});

test("getExplicitSwatch and getExplicitColorSwatch parse color and image swatches", () => {
  const colorMetadata = {
    ecs_option_value_presentation: {
      version: 1,
      swatch: { kind: "color", value: "#ff0000" },
    },
  };
  const imageMetadata = {
    ecs_option_value_presentation: {
      version: 1,
      swatch: { kind: "image", url: "https://media.ourdomain.com/floral.webp" },
    },
  };

  assert.deepEqual(getExplicitSwatch(colorMetadata), {
    kind: "color",
    value: "#ff0000",
    source: "explicit",
  });
  assert.deepEqual(getExplicitSwatch(imageMetadata), {
    kind: "image",
    url: "https://media.ourdomain.com/floral.webp",
    source: "explicit",
  });

  // Backwards compatibility check
  assert.deepEqual(getExplicitColorSwatch(colorMetadata), {
    kind: "color",
    value: "#ff0000",
    source: "explicit",
  });
  assert.deepEqual(getExplicitColorSwatch(imageMetadata), {
    kind: "image",
    url: "https://media.ourdomain.com/floral.webp",
    source: "explicit",
  });
});
