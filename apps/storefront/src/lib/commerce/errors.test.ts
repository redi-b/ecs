import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { customerFacingStoreError } from "./errors.js";

describe("customerFacingStoreError", () => {
  it("explains when a stale cart must be reviewed", () => {
    assert.equal(
      customerFacingStoreError("cart_items_unavailable"),
      "Your cart has changed. Review its items before checking out again.",
    );
  });
});
