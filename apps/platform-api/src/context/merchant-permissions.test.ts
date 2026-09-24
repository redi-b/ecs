import assert from "node:assert/strict";
import test from "node:test";

import {
  merchantRoles,
  normalizeMerchantRolePermissions,
  protectedMerchantRoleNames,
} from "./merchant-permissions.js";

test("merchant role presets enforce the intended privilege boundaries", () => {
  assert.equal(merchantRoles.owner.authorize({ ownership: ["transfer"] }).success, true);
  assert.equal(merchantRoles.manager.authorize({ orders: ["refund"] }).success, true);
  assert.equal(merchantRoles.manager.authorize({ ownership: ["transfer"] }).success, false);
  assert.equal(merchantRoles.staff.authorize({ products: ["update"] }).success, true);
  assert.equal(merchantRoles.staff.authorize({ products: ["publish"] }).success, false);
  assert.equal(merchantRoles.viewer.authorize({ orders: ["read"] }).success, true);
  assert.equal(merchantRoles.viewer.authorize({ orders: ["update"] }).success, false);
});

test("built-in merchant role names are stable and protected", () => {
  assert.deepEqual(protectedMerchantRoleNames, ["owner", "manager", "staff", "viewer"]);
});

test("custom role mutations always include the resource read permission", () => {
  assert.deepEqual(
    normalizeMerchantRolePermissions({
      domains: ["manage"],
      products: ["update", "delete"],
      storefront: ["edit"],
    }),
    {
      domains: ["manage"],
      products: ["read", "update", "delete"],
      storefront: ["read", "edit"],
    },
  );
});
