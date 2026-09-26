import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseStorefrontPreviewPageId } from "./storefront-preview-page-contract.js";

describe("storefront preview page descriptors", () => {
  it("defaults to home and rejects undeclared page ids", () => {
    assert.equal(parseStorefrontPreviewPageId(null), "home");
    assert.equal(parseStorefrontPreviewPageId("home"), "home");
    assert.equal(parseStorefrontPreviewPageId("products"), "products");
    assert.equal(parseStorefrontPreviewPageId("checkout"), null);
  });
});

it("passes both taxonomy kinds into the home preview renderer", () => {
  const source = readFileSync(new URL("./storefront-preview-pages.ts", import.meta.url), "utf8");
  assert.match(source, /collections: model\?\.collections/);
  assert.match(source, /categories: model\?\.categories/);
});
