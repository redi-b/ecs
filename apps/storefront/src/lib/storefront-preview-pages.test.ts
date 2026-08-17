import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseStorefrontPreviewPageId } from "./storefront-preview-page-contract.js";

describe("storefront preview page descriptors", () => {
  it("defaults to home and rejects undeclared page ids", () => {
    assert.equal(parseStorefrontPreviewPageId(null), "home");
    assert.equal(parseStorefrontPreviewPageId("home"), "home");
    assert.equal(parseStorefrontPreviewPageId("checkout"), null);
  });
});
