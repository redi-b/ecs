import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

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

  it("projects unconditional automatic item offers onto matching storefront products", async () => {
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        listMerchantPromotions: async () => ({
          ok: true,
          count: 1,
          limit: 100,
          offset: 0,
          promotions: [
            {
              allocation: "each",
              applyToQuantity: null,
              buyMinQuantity: null,
              buyProductIds: [],
              campaignBudgetLimit: null,
              campaignBudgetType: null,
              campaignName: "Collection sale",
              categoryIds: [],
              code: "AUTO15",
              collectionIds: ["pcol_1"],
              createdAt: "2026-09-30T00:00:00.000Z",
              currencyCode: null,
              endsAt: null,
              hasUnsupportedRules: false,
              id: "promo_1",
              isAutomatic: true,
              isTaxInclusive: false,
              maxQuantity: 1,
              method: "percentage",
              productIds: [],
              promotionType: "standard",
              registeredCustomersOnly: false,
              startsAt: null,
              status: "active",
              targetType: "items",
              updatedAt: "2026-09-30T00:00:00.000Z",
              usageCount: 0,
              usageLimit: null,
              value: 15,
            },
          ],
        }),
        medusaStoreFetch: async () =>
          Response.json({
            products: [
              {
                id: "prod_1",
                collection_id: "pcol_1",
                variants: [
                  {
                    id: "variant_1",
                    calculated_price: {
                      calculated_amount: 100,
                      original_amount: 100,
                      currency_code: "etb",
                    },
                  },
                ],
              },
              { id: "prod_2", collection_id: "pcol_2", variants: [] },
            ],
          }),
      },
    );

    const response = await app.request("/store/products", {
      headers: { Host: "abebe.lvh.me" },
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      products: Array<{ variants: Array<{ ecs_merchandising?: unknown }> }>;
    };
    assert.deepEqual(body.products[0]?.variants[0]?.ecs_merchandising, {
      discount_percentage: 15,
      promotion_id: "promo_1",
    });
    assert.equal(body.products[1]?.variants[0]?.ecs_merchandising, undefined);
  });

  it("does not advertise a conditional automatic offer before the cart proves eligibility", async () => {
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        listMerchantPromotions: async () => ({
          ok: true,
          count: 1,
          limit: 100,
          offset: 0,
          promotions: [
            {
              allocation: "each",
              applyToQuantity: null,
              buyMinQuantity: null,
              buyProductIds: [],
              campaignBudgetLimit: null,
              campaignBudgetType: null,
              campaignName: null,
              categoryIds: [],
              code: "MEMBER15",
              collectionIds: ["pcol_1"],
              createdAt: "2026-09-30T00:00:00.000Z",
              currencyCode: null,
              endsAt: null,
              hasUnsupportedRules: false,
              id: "promo_conditional",
              isAutomatic: true,
              isTaxInclusive: false,
              maxQuantity: null,
              method: "percentage",
              productIds: [],
              promotionType: "standard",
              registeredCustomersOnly: true,
              startsAt: null,
              status: "active",
              targetType: "items",
              updatedAt: "2026-09-30T00:00:00.000Z",
              usageCount: 0,
              usageLimit: null,
              value: 15,
            },
          ],
        }),
        medusaStoreFetch: async () =>
          Response.json({
            products: [
              {
                id: "prod_1",
                collection_id: "pcol_1",
                variants: [{ id: "variant_1" }],
              },
            ],
          }),
      },
    );

    const response = await app.request("/store/products", {
      headers: { Host: "abebe.lvh.me" },
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      products: Array<{ variants: Array<{ ecs_merchandising?: unknown }> }>;
    };
    assert.equal(body.products[0]?.variants[0]?.ecs_merchandising, undefined);
  });

  it("keeps products available when promotion projection is unavailable", async () => {
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        listMerchantPromotions: async () => {
          throw new Error("promotion backend unavailable");
        },
        medusaStoreFetch: async () => Response.json({ products: [{ id: "prod_1" }] }),
      },
    );

    const response = await app.request("/store/products", {
      headers: { Host: "abebe.lvh.me" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { products: [{ id: "prod_1" }] });
  });
});
