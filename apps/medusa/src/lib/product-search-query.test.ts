import assert from "node:assert/strict";
import { test } from "node:test";

import { adminProductSearchQuerySchema, productSearchQuerySchema } from "./product-search-query";

test("product search query trims text and applies bounded pagination defaults", () => {
  assert.deepEqual(productSearchQuerySchema.parse({ q: "  coffee  " }), {
    q: "coffee",
    limit: 24,
    offset: 0,
    option: [],
  });
  assert.equal(productSearchQuerySchema.safeParse({ q: "a" }).success, false);
  assert.equal(productSearchQuerySchema.safeParse({}).success, true);
  assert.equal(productSearchQuerySchema.safeParse({ q: "coffee", limit: 101 }).success, false);
  assert.deepEqual(
    productSearchQuerySchema.parse({
      q: "shoes",
      category_id: "pcat_1",
      collection_id: "pcol_1",
      order: "-title",
      option: [],
    }),
    {
      q: "shoes",
      category_id: "pcat_1",
      collection_id: "pcol_1",
      limit: 24,
      offset: 0,
      order: "-title",
      option: [],
    },
  );
  assert.equal(productSearchQuerySchema.safeParse({ q: "coffee", order: "price" }).success, true);
  assert.equal(productSearchQuerySchema.safeParse({ price_min: 200, price_max: 100 }).success, false);
});

test("admin product search accepts supported product statuses", () => {
  assert.equal(adminProductSearchQuerySchema.safeParse({
    q: "shirt",
    sales_channel_id: "sc_1",
    status: "draft",
  }).success, true);
  assert.equal(adminProductSearchQuerySchema.safeParse({
    q: "shirt",
    sales_channel_id: "sc_1",
    status: "archived",
  }).success, false);
});
