import assert from "node:assert/strict";
import test from "node:test";
import { translationPermission } from "./catalog-translations";

test("catalog translations use the permission belonging to their resource", () => {
  assert.deepEqual(translationPermission("product", "read"), { products: ["read"] });
  assert.deepEqual(translationPermission("product_category", "update"), { products: ["update"] });
  assert.deepEqual(translationPermission("shipping_option", "read"), { settings: ["read"] });
  assert.deepEqual(translationPermission("shipping_option", "update"), { settings: ["manage"] });
});
