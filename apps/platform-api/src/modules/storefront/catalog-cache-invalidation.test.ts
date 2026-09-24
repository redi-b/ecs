import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTenantIdForCatalogWrite,
  withStorefrontCatalogPurge,
  wrapProductServiceWithStorefrontPurge,
} from "./catalog-cache-invalidation.js";

test("resolveTenantIdForCatalogWrite prefers tenantId", async () => {
  const tenantId = await resolveTenantIdForCatalogWrite(
    { tenantId: "tenant_a", salesChannelId: "sc_ignored" },
    async () => "tenant_from_sc",
  );
  assert.equal(tenantId, "tenant_a");
});

test("resolveTenantIdForCatalogWrite falls back to sales channel lookup", async () => {
  let seen: string | null = null;
  const tenantId = await resolveTenantIdForCatalogWrite(
    { salesChannelId: "sc_1" },
    async (salesChannelId) => {
      seen = salesChannelId;
      return "tenant_b";
    },
  );
  assert.equal(seen, "sc_1");
  assert.equal(tenantId, "tenant_b");
});

test("withStorefrontCatalogPurge does not purge on failed writes", async () => {
  const previous = process.env.STOREFRONT_CACHE_PURGE_SECRET;
  process.env.STOREFRONT_CACHE_PURGE_SECRET = "secret";
  process.env.STOREFRONT_INTERNAL_BASE_URL = "http://storefront.test";

  let fetchCount = 0;
  const wrapped = withStorefrontCatalogPurge(
    async () => ({ ok: false as const, error: "nope" }),
    {
      resolveTenantIdBySalesChannelId: async () => "tenant_1",
    },
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    const result = await wrapped({ salesChannelId: "sc_1" });
    assert.equal(result.ok, false);
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.STOREFRONT_CACHE_PURGE_SECRET;
    else process.env.STOREFRONT_CACHE_PURGE_SECRET = previous;
  }
});

test("withStorefrontCatalogPurge purges tenant after successful write", async () => {
  const previousSecret = process.env.STOREFRONT_CACHE_PURGE_SECRET;
  const previousBase = process.env.STOREFRONT_INTERNAL_BASE_URL;
  process.env.STOREFRONT_CACHE_PURGE_SECRET = "secret";
  process.env.STOREFRONT_INTERNAL_BASE_URL = "http://storefront.test";

  let purgedTenant: string | null = null;
  const wrapped = withStorefrontCatalogPurge(
    async () => ({ ok: true as const, product: { id: "p1" } }),
    {
      resolveTenantIdBySalesChannelId: async () => "tenant_xyz",
    },
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { tenantId?: string };
    purgedTenant = body.tenantId ?? null;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await wrapped({ salesChannelId: "sc_1" });
    assert.equal(result.ok, true);
    assert.equal(purgedTenant, "tenant_xyz");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousSecret === undefined) delete process.env.STOREFRONT_CACHE_PURGE_SECRET;
    else process.env.STOREFRONT_CACHE_PURGE_SECRET = previousSecret;
    if (previousBase === undefined) delete process.env.STOREFRONT_INTERNAL_BASE_URL;
    else process.env.STOREFRONT_INTERNAL_BASE_URL = previousBase;
  }
});

test("wrapProductServiceWithStorefrontPurge only wraps write methods", async () => {
  let listCalls = 0;
  let updateCalls = 0;
  let purgeFetch = 0;

  const previousSecret = process.env.STOREFRONT_CACHE_PURGE_SECRET;
  const previousBase = process.env.STOREFRONT_INTERNAL_BASE_URL;
  process.env.STOREFRONT_CACHE_PURGE_SECRET = "secret";
  process.env.STOREFRONT_INTERNAL_BASE_URL = "http://storefront.test";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    purgeFetch += 1;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const service = wrapProductServiceWithStorefrontPurge(
      {
        listMerchantProducts: async (_input: { salesChannelId: string }) => {
          listCalls += 1;
          return { ok: true, products: [] };
        },
        updateMerchantProduct: async (_input: {
          salesChannelId: string;
          productId: string;
        }) => {
          updateCalls += 1;
          return { ok: true, product: { id: "p1" } };
        },
      },
      {
        resolveTenantIdBySalesChannelId: async () => "tenant_1",
      },
    );

    await service.listMerchantProducts({ salesChannelId: "sc" });
    await service.updateMerchantProduct({ salesChannelId: "sc", productId: "p1" });

    assert.equal(listCalls, 1);
    assert.equal(updateCalls, 1);
    assert.equal(purgeFetch, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousSecret === undefined) delete process.env.STOREFRONT_CACHE_PURGE_SECRET;
    else process.env.STOREFRONT_CACHE_PURGE_SECRET = previousSecret;
    if (previousBase === undefined) delete process.env.STOREFRONT_INTERNAL_BASE_URL;
    else process.env.STOREFRONT_INTERNAL_BASE_URL = previousBase;
  }
});
