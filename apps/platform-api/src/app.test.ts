import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPlatformApp } from "./app.js";
import type { TenantContext, TenantResolutionResult } from "./tenancy/tenant-resolver.js";

const resolvedTenantContext: TenantContext = {
  tenantId: "tenant_1",
  hostname: "abebe.lvh.me",
  domainId: "domain_1",
  status: "active",
  medusaStoreId: "store_1",
  medusaSalesChannelId: "channel_1",
  medusaPublishableKeyId: "pk_1",
  publishedRevisionId: "revision_1",
  templateId: "template_1",
  templateVersion: 1,
};

function appWithResolution(
  result: TenantResolutionResult,
  options?: {
    medusaStoreFetch?: typeof fetch;
  },
) {
  return createPlatformApp({
    serviceName: "platform-api",
    medusaInternalUrl: "http://medusa:9000",
    ...(options?.medusaStoreFetch ? { medusaStoreFetch: options.medusaStoreFetch } : {}),
    resolveTenantForHost: async () => result,
  });
}

describe("platform app", () => {
  it("returns health status", async () => {
    const app = appWithResolution({ ok: false, error: "shop_context_required" });

    const response = await app.request("/health");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "platform-api",
    });
  });

  it("returns shop_context_required for central store requests without trusted shop context", async () => {
    const app = appWithResolution({ ok: false, error: "shop_context_required" });

    const response = await app.request("/store/products", {
      headers: {
        Host: "api.lvh.me",
      },
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "shop_context_required",
    });
  });

  it("returns shop_not_found for unknown storefront hosts", async () => {
    const app = appWithResolution({ ok: false, error: "shop_not_found" });

    const response = await app.request("/store/products", {
      headers: {
        Host: "missing.lvh.me",
      },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "shop_not_found",
    });
  });

  it("forwards resolved store requests to Medusa with the tenant publishable key", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json(
        {
          products: [],
        },
        {
          status: 200,
          headers: {
            "x-medusa-request-id": "medusa_req_1",
          },
        },
      );
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/products?limit=10", {
      headers: {
        Host: "abebe.lvh.me",
        "x-publishable-api-key": "client_supplied_key",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      products: [],
    });
    assert.equal(response.headers.get("x-medusa-request-id"), "medusa_req_1");
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/products?limit=10");
    assert.equal(forwardedRequest.headers.get("x-publishable-api-key"), "pk_1");
    assert.equal(forwardedRequest.headers.get("host"), null);
  });

  it("preserves method and body when forwarding store requests", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);
      return Response.json({ cart: { id: "cart_1" } }, { status: 201 });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/carts", {
      method: "POST",
      body: JSON.stringify({ region_id: "reg_1" }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 201);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(await forwardedRequest.text(), JSON.stringify({ region_id: "reg_1" }));
  });

  it("does not forward resolved tenants without a publishable key", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: {
          ...resolvedTenantContext,
          medusaPublishableKeyId: null,
        },
      },
      {
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/products", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "domain_misconfigured",
    });
    assert.equal(fetchCalls, 0);
  });

  it("returns commerce_backend_unavailable when Medusa cannot be reached", async () => {
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        medusaStoreFetch: async () => {
          throw new TypeError("fetch failed");
        },
      },
    );

    const response = await app.request("/store/products", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "commerce_backend_unavailable",
    });
  });
});
