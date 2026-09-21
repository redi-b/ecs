import assert from "node:assert/strict";
import test from "node:test";

import { PRODUCT_LIST_FIELDS } from "./urls.js";

test("product list requests gallery media needed for an accurate asset count", () => {
  const fields = new Set(PRODUCT_LIST_FIELDS.split(","));

  assert.equal(fields.has("thumbnail"), true);
  assert.equal(fields.has("images.id"), true);
  assert.equal(fields.has("images.url"), true);
});
