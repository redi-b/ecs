import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appWithResolution,
  resolvedTenantContext,
} from "../support/platform-app-harness.js";

describe("storefront facade guards", () => {
  it("does not forward unsupported store facade routes", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/plugins/internal", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "store_route_not_allowed",
    });
    assert.equal(fetchCalls, 0);
  });

  it("forwards cart promotion changes to Medusa", async () => {
    const forwarded: Request[] = [];
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        medusaStoreFetch: async (request) => {
          forwarded.push(request instanceof Request ? request : new Request(request));
          return Response.json({ cart: { id: "cart_1" } });
        },
      },
    );

    for (const method of ["POST", "DELETE"] as const) {
      const response = await app.request("/store/carts/cart_1/promotions", {
        body: JSON.stringify({ promo_codes: ["BOLESTWELCOME10"] }),
        headers: {
          "content-type": "application/json",
          Host: "abebe.lvh.me",
        },
        method,
      });
      assert.equal(response.status, 200);
    }

    assert.equal(forwarded.length, 2);
    for (const request of forwarded) {
      assert.equal(request.url, "http://medusa:9000/store/carts/cart_1/promotions");
      assert.equal(request.headers.get("x-publishable-api-key"), "pk_1");
      assert.deepEqual(JSON.parse(await request.text()), {
        promo_codes: ["BOLESTWELCOME10"],
      });
    }
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
