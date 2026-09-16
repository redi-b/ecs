import assert from "node:assert/strict";
import test from "node:test";

import {
  getPublicProductHandle,
  getTenantProductHandle,
  getTenantProductMetadata,
} from "./handles.js";

test("tenant product handles keep the same public handle independent across shops", () => {
  const first = getTenantProductHandle("tenant_one", "test");
  const second = getTenantProductHandle("tenant_two", "test");

  assert.notEqual(first, second);
  assert.match(first, /^ecs-[a-f0-9]{12}-test$/);
  assert.equal(getPublicProductHandle({ handle: first, tenantId: "tenant_one" }), "test");
  assert.equal(getPublicProductHandle({ handle: second, tenantId: "tenant_two" }), "test");
});

test("public product handle metadata preserves merchant-facing URLs", () => {
  const metadata = getTenantProductMetadata("tenant_one", "linen-shirt", { source: "import" });
  assert.deepEqual(metadata, {
    source: "import",
    platform_tenant_id: "tenant_one",
    platform_public_handle: "linen-shirt",
  });
  assert.equal(
    getPublicProductHandle({ handle: "internal", metadata }),
    "linen-shirt",
  );
});

test("legacy product handles remain unchanged", () => {
  assert.equal(
    getPublicProductHandle({ handle: "legacy-shirt", tenantId: "tenant_one" }),
    "legacy-shirt",
  );
});
