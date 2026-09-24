import assert from "node:assert/strict";
import test from "node:test";

import { resolveProductColorSwatch } from "./product-color";

test("uses saved product swatches before named-color fallbacks", () => {
  assert.equal(resolveProductColorSwatch("Color", "Blue", "#123ABC"), "#123abc");
});

test("shows swatches for legacy products with common color labels", () => {
  assert.equal(resolveProductColorSwatch("Color", "Blue"), "#2563eb");
  assert.equal(resolveProductColorSwatch("Colour", "Grey"), "#6b7280");
});

test("does not guess colors for unrelated option axes", () => {
  assert.equal(resolveProductColorSwatch("Size", "Blue"), null);
  assert.equal(resolveProductColorSwatch("Color", "Midnight custom"), null);
});
