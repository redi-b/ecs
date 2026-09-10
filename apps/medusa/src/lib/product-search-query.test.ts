import assert from "node:assert/strict";
import { test } from "node:test";

import { productSearchQuerySchema } from "./product-search-query";

test("product search query trims text and applies bounded pagination defaults", () => {
  assert.deepEqual(productSearchQuerySchema.parse({ q: "  coffee  " }), {
    q: "coffee",
    limit: 24,
    offset: 0,
  });
  assert.equal(productSearchQuerySchema.safeParse({ q: "a" }).success, false);
  assert.equal(productSearchQuerySchema.safeParse({ q: "coffee", limit: 101 }).success, false);
});
