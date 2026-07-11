import assert from "node:assert/strict";
import { test } from "node:test";

import { getStorefrontHostname, normalizeStorefrontBaseDomain } from "./storefront-hosts.js";

test("storefront hostnames use the configured deployment domain", () => {
  assert.equal(normalizeStorefrontBaseDomain(".ECS.Example.com."), "ecs.example.com");
  assert.equal(getStorefrontHostname("merchant", "ecs.example.com"), "merchant.ecs.example.com");
});
