import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCategoryMedia, resolveCollectionMedia } from "./taxonomy-media";
import type { StoreProduct } from "./types";

const product = {
  id: "prod_1",
  title: "Jacket",
  handle: "jacket",
  description: null,
  thumbnail: "https://cdn.test/original.webp",
  thumbnailVariants: { w400: "https://cdn.test/400.webp", w800: "https://cdn.test/800.webp" },
  images: [],
  gallery: [],
  variants: [],
  options: [],
  collectionId: "col_1",
  collectionTitle: "Outerwear",
  categoryIds: ["cat_1"],
  priceAmount: 100,
  currencyCode: "ETB",
} satisfies StoreProduct;

describe("taxonomy media resolution", () => {
  it("prefers assigned taxonomy media", () => {
    assert.equal(
      resolveCategoryMedia(
        {
          id: "cat_1",
          name: "Jackets",
          handle: "jackets",
          parentCategoryId: null,
          mediaUrl: "https://cdn.test/category.webp",
        },
        [product],
      ),
      "https://cdn.test/category.webp",
    );
  });

  it("uses the first matching product cover when taxonomy media is empty", () => {
    assert.equal(
      resolveCategoryMedia(
        { id: "cat_1", name: "Jackets", handle: "jackets", parentCategoryId: null, mediaUrl: null },
        [product],
      ),
      "https://cdn.test/800.webp",
    );
    assert.equal(
      resolveCollectionMedia(
        { id: "col_1", title: "Outerwear", handle: "outerwear", mediaUrl: null },
        [product],
      ),
      "https://cdn.test/800.webp",
    );
  });

  it("returns null when no image is available", () => {
    assert.equal(
      resolveCollectionMedia({ id: "col_empty", title: "Empty", handle: "empty", mediaUrl: null }, [
        product,
      ]),
      null,
    );
  });
});
