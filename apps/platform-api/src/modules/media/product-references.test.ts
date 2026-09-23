import assert from "node:assert/strict";
import test from "node:test";
import type { MerchantProduct } from "../../types/index.js";
import { getProductMediaReferences } from "./product-references.js";

test("usage tracking includes gallery photos, standalone image swatches and variant photos", () => {
  const product: MerchantProduct = {
    id: "prod_1",
    title: "Shirt",
    handle: "shirt",
    status: "published",
    thumbnail: "https://media.example/cover.jpg",
    createdAt: null,
    updatedAt: null,
    images: [
      {
        id: "img_1",
        url: "https://media.example/gallery.jpg",
        rank: 0,
        createdAt: null,
        updatedAt: null,
      },
    ],
    options: [
      {
        id: "opt_1",
        title: "Pattern",
        values: [
          {
            id: "val_1",
            label: "Striped",
            swatch: { kind: "image", url: "https://media.example/swatch.jpg", source: "explicit" },
          },
        ],
      },
    ],
    variants: [
      {
        id: "var_1",
        title: "Striped",
        sku: null,
        prices: [],
        imageUrl: "https://media.example/variant.jpg",
      },
    ],
  };
  assert.deepEqual(getProductMediaReferences(product), {
    imageUrls: ["https://media.example/gallery.jpg", "https://media.example/swatch.jpg"],
    variantImageUrls: ["https://media.example/variant.jpg"],
    thumbnail: "https://media.example/cover.jpg",
  });
});
