import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allows, merchantPolicies } from "./access-policy.js";

describe("merchant access policies", () => {
  it("supports read-only storefront access without edit or publish authority", () => {
    const permissions = ["storefront.read"];
    assert.equal(allows(permissions, merchantPolicies.storefront), true);
    assert.equal(allows(permissions, merchantPolicies.storefrontEdit), false);
    assert.equal(allows(permissions, merchantPolicies.storefrontPublish), false);
  });

  it("keeps personal settings membership-accessible", () => {
    assert.equal(allows([], merchantPolicies.settings), true);
    assert.equal(allows([], merchantPolicies.shopSettings), false);
  });

  it("requires every permission for all-of policies", () => {
    assert.equal(
      allows(["storefront.edit"], { allOf: ["storefront.edit", "storefront.publish"] }),
      false,
    );
  });
});
