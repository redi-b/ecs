import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTenantProductHandle } from "../../src/adapters/medusa/product/handles.js";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("storefront catalog facade", () => {
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

  it("maps tenant-namespaced product handles to stable storefront handles", async () => {
    const forwarded: Request[] = [];
    const storedHandle = getTenantProductHandle(resolvedTenantContext.tenantId, "test");
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        medusaStoreFetch: async (request) => {
          forwarded.push(request instanceof Request ? request : new Request(request));
          return Response.json({
            products: [{ id: "prod_1", handle: storedHandle, title: "Test" }],
            count: 1,
            limit: 1,
            offset: 0,
          });
        },
      },
    );

    const response = await app.request("/store/products?handle=test&limit=1", {
      headers: { Host: "abebe.lvh.me" },
    });

    assert.equal(response.status, 200);
    assert.equal(new URL(forwarded[0]!.url).searchParams.get("handle"), storedHandle);
    assert.deepEqual(await response.json(), {
      products: [{ id: "prod_1", handle: "test", title: "Test" }],
      count: 1,
      limit: 1,
      offset: 0,
    });
  });

  it("falls back to legacy unnamespaced product handles", async () => {
    const forwarded: Request[] = [];
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        medusaStoreFetch: async (request) => {
          const forwardedRequest = request instanceof Request ? request : new Request(request);
          forwarded.push(forwardedRequest);
          const handle = new URL(forwardedRequest.url).searchParams.get("handle");
          return Response.json({
            products: handle === "legacy-shirt" ? [{ id: "prod_legacy", handle }] : [],
            count: handle === "legacy-shirt" ? 1 : 0,
            limit: 1,
            offset: 0,
          });
        },
      },
    );

    const response = await app.request("/store/products?handle=legacy-shirt&limit=1", {
      headers: { Host: "abebe.lvh.me" },
    });

    assert.equal(response.status, 200);
    assert.equal(forwarded.length, 2);
    assert.equal(new URL(forwarded[1]!.url).searchParams.get("handle"), "legacy-shirt");
    assert.deepEqual((await response.json()).products, [
      { id: "prod_legacy", handle: "legacy-shirt" },
    ]);
  });

  it("forwards storefront product search to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);
      return Response.json({ product_ids: ["prod_1"], count: 1, limit: 24, offset: 0 });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/product-search?q=cofee&limit=24", {
      headers: { Host: "abebe.lvh.me" },
    });

    assert.equal(response.status, 200);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/product-search?q=cofee&limit=24");
    assert.equal(forwardedRequest.headers.get("x-publishable-api-key"), "pk_1");
  });
});
