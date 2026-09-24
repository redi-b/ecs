import assert from "node:assert/strict";
import test from "node:test";

import { purgeStorefrontTenantCache } from "./cache-purge.js";

test("purgeStorefrontTenantCache skips when secret is not configured", async () => {
  const previous = process.env.STOREFRONT_CACHE_PURGE_SECRET;
  delete process.env.STOREFRONT_CACHE_PURGE_SECRET;

  const result = await purgeStorefrontTenantCache({
    tenantId: "tenant_1",
    fetcher: async () => {
      throw new Error("should not call fetch");
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);

  if (previous === undefined) {
    delete process.env.STOREFRONT_CACHE_PURGE_SECRET;
  } else {
    process.env.STOREFRONT_CACHE_PURGE_SECRET = previous;
  }
});

test("purgeStorefrontTenantCache posts tenant tags to storefront", async () => {
  const previousSecret = process.env.STOREFRONT_CACHE_PURGE_SECRET;
  const previousBase = process.env.STOREFRONT_INTERNAL_BASE_URL;
  process.env.STOREFRONT_CACHE_PURGE_SECRET = "test-secret";
  process.env.STOREFRONT_INTERNAL_BASE_URL = "http://storefront.test";

  let capturedUrl = "";
  let capturedBody = "";
  let capturedSecret = "";

  const result = await purgeStorefrontTenantCache({
    tenantId: "tenant_abc",
    fetcher: async (input, init) => {
      capturedUrl =
        typeof input === "string" ? input : input instanceof URL ? input.href : String(input);
      capturedBody = String(init?.body ?? "");
      const headers = init?.headers as Record<string, string> | undefined;
      capturedSecret = headers?.["x-ecs-cache-purge-secret"] ?? "";
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });

  assert.equal(result.ok, true);
  assert.match(capturedUrl, /\/internal\/cache-purge$/);
  assert.equal(capturedSecret, "test-secret");
  const body = JSON.parse(capturedBody) as { tenantId?: string; tags?: string[] };
  assert.equal(body.tenantId, "tenant_abc");
  assert.ok(body.tags?.includes("tenant:tenant_abc"));

  if (previousSecret === undefined) {
    delete process.env.STOREFRONT_CACHE_PURGE_SECRET;
  } else {
    process.env.STOREFRONT_CACHE_PURGE_SECRET = previousSecret;
  }
  if (previousBase === undefined) {
    delete process.env.STOREFRONT_INTERNAL_BASE_URL;
  } else {
    process.env.STOREFRONT_INTERNAL_BASE_URL = previousBase;
  }
});
