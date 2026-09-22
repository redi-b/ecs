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

  it("uses the active storefront language and never exposes unknown upstream text", () => {
    assert.equal(
      customerFacingStoreError("cart_items_unavailable", "am"),
      "ዘንቢልዎ ተቀይሯል። እንደገና ከመክፈልዎ በፊት ዕቃዎቹን ያረጋግጡ።",
    );
    assert.equal(
      customerFacingStoreError("database_connection_refused", "en"),
      "Something went wrong. Please try again.",
    );
  });
});
