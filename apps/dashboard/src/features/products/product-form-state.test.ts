import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { suggestAvailableProductHandle } from "./product-form-state";

describe("product handle conflict suggestions", () => {
  it("adds a safe numeric suffix to a product handle", () => {
    assert.equal(suggestAvailableProductHandle("coffee-beans"), "coffee-beans-2");
  });

  it("increments an existing numeric suffix", () => {
    assert.equal(suggestAvailableProductHandle("coffee-beans-2"), "coffee-beans-3");
  });

  it("provides a valid fallback when the handle is empty", () => {
    assert.equal(suggestAvailableProductHandle(""), "product-2");
  });
});
