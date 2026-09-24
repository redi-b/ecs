import assert from "node:assert/strict";
import test from "node:test";
import {
  filterProductGallery,
  normalizeCart,
  normalizeProduct,
  normalizeStoreProduct,
} from "./normalize.js";
import type { StoreProductImage } from "./types.js";

test("filterProductGallery returns all images when bindings are missing or empty", () => {
  const images: StoreProductImage[] = [
    { url: "https://media.example.com/img1.jpg" },
    { url: "https://media.example.com/img2.jpg" },
  ];

  assert.deepEqual(
    filterProductGallery({
      images,
      selectedOptions: { Color: "Red" },
      optionMediaBindings: null,
    }),
    images,
  );

  assert.deepEqual(
    filterProductGallery({
      images,
      selectedOptions: { Color: "Red" },
      optionMediaBindings: { optionTitle: "Color", mappings: {} },
    }),
    images,
  );
});

test("filterProductGallery filters by selected option and preserves universal photos", () => {
  const images: StoreProductImage[] = [
    { url: "https://media.example.com/red-1.jpg" },
    { url: "https://media.example.com/red-2.jpg" },
    { url: "https://media.example.com/blue-1.jpg" },
    { url: "https://media.example.com/universal-size-chart.jpg" },
  ];

  const optionMediaBindings = {
    optionTitle: "Color",
    mappings: {
      Red: ["https://media.example.com/red-1.jpg", "https://media.example.com/red-2.jpg"],
      Blue: ["https://media.example.com/blue-1.jpg"],
    },
  };

  // When Red is selected: red-1, red-2 and universal size chart should be visible
  const redFiltered = filterProductGallery({
    images,
    selectedOptions: { Color: "Red" },
    optionMediaBindings,
  });

  assert.deepEqual(
    redFiltered.map((i) => i.url),
    [
      "https://media.example.com/red-1.jpg",
      "https://media.example.com/red-2.jpg",
      "https://media.example.com/universal-size-chart.jpg",
    ],
  );

  // When Blue is selected: blue-1 and universal size chart should be visible
  const blueFiltered = filterProductGallery({
    images,
    selectedOptions: { color: "blue" }, // test case-insensitivity
    optionMediaBindings,
  });

  assert.deepEqual(
    blueFiltered.map((i) => i.url),
    ["https://media.example.com/blue-1.jpg", "https://media.example.com/universal-size-chart.jpg"],
  );
});

test("filterProductGallery falls back to all images if selection not found or results in empty gallery", () => {
  const images: StoreProductImage[] = [
    { url: "https://media.example.com/red-1.jpg" },
    { url: "https://media.example.com/blue-1.jpg" },
  ];

  const optionMediaBindings = {
    optionTitle: "Color",
    mappings: {
      Red: ["https://media.example.com/red-1.jpg"],
      Blue: ["https://media.example.com/blue-1.jpg"],
    },
  };

  // Unknown option value
  const unknownValue = filterProductGallery({
    images,
    selectedOptions: { Color: "Green" },
    optionMediaBindings,
  });
  assert.deepEqual(unknownValue, images);

  // Missing option selection
  const missingOption = filterProductGallery({
    images,
    selectedOptions: { Size: "L" },
    optionMediaBindings,
  });
  assert.deepEqual(missingOption, images);

  // Empty result fallback
  const fallback = filterProductGallery({
    images: [{ url: "https://media.example.com/other-tagged.jpg" }],
    selectedOptions: { Color: "Red" },
    optionMediaBindings: {
      optionTitle: "Color",
      mappings: {
        Red: [],
        Blue: ["https://media.example.com/other-tagged.jpg"],
      },
    },
  });
  assert.deepEqual(fallback, [{ url: "https://media.example.com/other-tagged.jpg" }]);
});

test("normalizeStoreProduct parses optionMediaBindings from metadata or direct property", () => {
  const productWithMetadata = normalizeStoreProduct({
    id: "prod_1",
    title: "Jacket",
    metadata: {
      option_media_bindings: {
        optionTitle: "Color",
        mappings: {
          Black: ["https://media.example.com/black.jpg"],
        },
      },
    },
  });

  assert.deepEqual(productWithMetadata.optionMediaBindings, {
    optionTitle: "Color",
    mappings: {
      Black: ["https://media.example.com/black.jpg"],
    },
  });

  const productWithStringMetadata = normalizeProduct({
    id: "prod_2",
    title: "Jacket 2",
    metadata: {
      option_media_bindings: JSON.stringify({
        optionTitle: "Color",
        mappings: {
          Navy: ["https://media.example.com/navy.jpg"],
        },
      }),
    },
  });

  assert.deepEqual(productWithStringMetadata.optionMediaBindings, {
    optionTitle: "Color",
    mappings: {
      Navy: ["https://media.example.com/navy.jpg"],
    },
  });

  const productWithout = normalizeStoreProduct({
    id: "prod_3",
    title: "Jacket 3",
  });
  assert.equal(productWithout.optionMediaBindings, undefined);
});

test("normalizeStoreProduct parses both color and image swatches", () => {
  const product = normalizeStoreProduct({
    id: "prod_1",
    title: "Curtains",
    options: [
      {
        id: "opt_pattern",
        title: "Pattern",
        values: [
          {
            id: "val_solid_red",
            value: "Solid Red",
            metadata: {
              ecs_option_value_presentation: {
                version: 1,
                displayMode: "swatch",
                swatch: { kind: "color", value: "#FF0000" },
              },
            },
          },
          {
            id: "val_floral",
            value: "Floral Silk",
            metadata: {
              ecs_option_value_presentation: {
                version: 1,
                swatch: { kind: "image", url: "https://media.example.com/floral.webp" },
              },
            },
          },
        ],
      },
    ],
    variants: [],
  });

  const option = product.options[0];
  assert.ok(option);

  assert.equal(option?.displayMode, "swatch");

  // Rich swatches support both color and image
  assert.deepEqual(option?.optionSwatches, {
    "Solid Red": { kind: "color", value: "#ff0000" },
    "Floral Silk": { kind: "image", url: "https://media.example.com/floral.webp" },
  });

  // Backwards compatibility: only color swatches in swatches
  assert.deepEqual(option?.swatches, {
    "Solid Red": "#ff0000",
  });
});

test("normalizeVariant extracts imageUrl and imageVariants", () => {
  const product = normalizeStoreProduct({
    id: "prod_1",
    title: "Dress",
    metadata: {
      media_variants: {
        "https://media.example.com/var1.jpg": {
          w200: "https://media.example.com/var1-200.jpg",
          w800: "https://media.example.com/var1-800.jpg",
        },
      },
    },
    variants: [
      {
        id: "var_1",
        title: "Red / S",
        metadata: {
          image_url: "https://media.example.com/var1.jpg",
        },
      },
      {
        id: "var_2",
        title: "Blue / S",
        imageUrl: "https://media.example.com/var2.jpg",
      },
      {
        id: "var_3",
        title: "Green / S",
        thumbnail: "https://media.example.com/var3.jpg",
      },
    ],
  });

  assert.equal(product.variants[0]?.imageUrl, "https://media.example.com/var1.jpg");
  assert.deepEqual(product.variants[0]?.imageVariants, {
    w200: "https://media.example.com/var1-200.jpg",
    w800: "https://media.example.com/var1-800.jpg",
  });

  assert.equal(product.variants[1]?.imageUrl, "https://media.example.com/var2.jpg");
  assert.equal(product.variants[2]?.imageUrl, "https://media.example.com/var3.jpg");
});

test("normalizeCart uses variant.imageUrl as preferred line item thumbnail", () => {
  const cart = normalizeCart({
    id: "cart_1",
    items: [
      {
        id: "item_1",
        title: "Silk Shirt",
        thumbnail: "https://media.example.com/product-thumb.jpg",
        variant: {
          id: "var_1",
          title: "Blue",
          metadata: {
            image_url: "https://media.example.com/var-blue.jpg",
          },
        },
      },
      {
        id: "item_2",
        title: "Linen Pants",
        thumbnail: "https://media.example.com/pants-thumb.jpg",
        variant: {
          id: "var_2",
          title: "White",
        },
      },
    ],
  });

  assert.equal(cart.items[0]?.thumbnail, "https://media.example.com/var-blue.jpg");
  assert.equal(cart.items[1]?.thumbnail, "https://media.example.com/pants-thumb.jpg");
});
