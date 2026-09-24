import assert from "node:assert/strict";
import test from "node:test";

import {
  builtInMerchantRoleAllows,
  getBuiltInMerchantCapabilities,
  getBuiltInMerchantPermissions,
} from "./merchant-authorization.js";

test("built-in merchant roles enforce operational boundaries", () => {
  assert.equal(builtInMerchantRoleAllows("owner", { ownership: ["transfer"] }), true);
  assert.equal(builtInMerchantRoleAllows("manager", { ownership: ["transfer"] }), false);
  assert.equal(builtInMerchantRoleAllows("manager", { products: ["publish"] }), true);
  assert.equal(builtInMerchantRoleAllows("staff", { products: ["publish"] }), false);
  assert.equal(builtInMerchantRoleAllows("staff", { orders: ["update"] }), true);
  assert.equal(builtInMerchantRoleAllows("viewer", { orders: ["update"] }), false);
  assert.equal(builtInMerchantRoleAllows("viewer", { orders: ["read"] }), true);
});

test("a role must satisfy the complete permission request", () => {
  assert.equal(
    builtInMerchantRoleAllows("staff", {
      orders: ["read", "refund"],
    }),
    false,
  );
});

test("UI projections use the same access-control definitions as route authorization", () => {
  assert.equal(getBuiltInMerchantCapabilities("viewer").includes("editor"), false);
  assert.equal(getBuiltInMerchantCapabilities("staff").includes("editor"), true);
  assert.equal(getBuiltInMerchantPermissions("viewer").includes("products.read"), true);
  assert.equal(getBuiltInMerchantPermissions("viewer").includes("products.update"), false);
  assert.equal(getBuiltInMerchantPermissions("staff").includes("media.manage"), true);
  assert.equal(getBuiltInMerchantPermissions("staff").includes("storefront.publish"), false);
  assert.equal(getBuiltInMerchantPermissions("owner").includes("ownership.transfer"), true);
});
