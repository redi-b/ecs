import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { roleKey } from "./team-role-name";

describe("team role names", () => {
  it("turns a friendly role name into the stable Better Auth role key", () => {
    assert.equal(roleKey("Catalog Editor"), "catalog-editor");
    assert.equal(roleKey("  Order-Fulfillment Lead  "), "order-fulfillment-lead");
    assert.equal(roleKey("Stock_and Price"), "stock-and-price");
  });

  it("removes punctuation and invalid leading characters", () => {
    assert.equal(roleKey("42. Product lead!"), "product-lead");
  });
});
