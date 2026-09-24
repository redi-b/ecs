import assert from "node:assert/strict";
import { test } from "node:test";
import { productListFiltersSchema } from "./product-list-filters.js";
import { taxonomyListFiltersSchema } from "./taxonomy-list-filters.js";

test("list and export product filters share validation", () => {
  assert.deepEqual(
    productListFiltersSchema.parse({
      status: "all",
      media: "without_media",
      categoryId: "none",
      q: " Coffee ",
    }),
    { status: undefined, media: "without_media", categoryId: "none", q: "Coffee" },
  );
  for (const value of [{ status: "deleted" }, { media: "video" }, { q: "x".repeat(201) }])
    assert.equal(productListFiltersSchema.safeParse(value).success, false);
});
test("taxonomy filter validation rejects unsupported visibility", () => {
  assert.deepEqual(taxonomyListFiltersSchema.parse({ visibility: "public", parentId: "root" }), {
    visibility: "public",
    parentId: "root",
  });
  assert.equal(taxonomyListFiltersSchema.safeParse({ visibility: "draft" }).success, false);
});
