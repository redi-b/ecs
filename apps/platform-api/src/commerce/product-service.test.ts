import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMedusaProductService } from "./product-service.js";

describe("createMedusaProductService", () => {
  it("creates a product in the resolved tenant sales channel", async () => {
    let forwardedRequest: Request | undefined;
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          product: {
            id: "prod_1",
            title: "Coffee",
            handle: "coffee",
            status: "draft",
            thumbnail: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.createMerchantProduct({
      title: "Coffee",
      handle: "coffee",
      status: "draft",
      thumbnail: null,
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/admin/products");
    assert.equal(forwardedRequest.headers.get("x-medusa-access-token"), "medusa_token");
    assert.equal(forwardedRequest.headers.get("content-type"), "application/json");
    assert.deepEqual(await forwardedRequest.json(), {
      title: "Coffee",
      handle: "coffee",
      status: "draft",
      sales_channels: ["sc_1"],
    });
    assert.deepEqual(result, {
      ok: true,
      product: {
        id: "prod_1",
        title: "Coffee",
        handle: "coffee",
        status: "draft",
        thumbnail: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("updates a product only when it belongs to the resolved tenant sales channel", async () => {
    const forwardedRequests: Request[] = [];
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        if (request.method === "GET") {
          return Response.json({
            product: {
              id: "prod_1",
              sales_channels: [{ id: "sc_1" }],
            },
          });
        }

        return Response.json({
          product: {
            id: "prod_1",
            title: "Updated coffee",
            handle: "coffee",
            status: "published",
            thumbnail: "https://cdn.test/coffee.jpg",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-03T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.updateMerchantProduct({
      productId: "prod_1",
      title: "Updated coffee",
      status: "published",
      thumbnail: "https://cdn.test/coffee.jpg",
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequests.length, 2);
    assert.equal(
      forwardedRequests[0]?.url,
      "http://medusa:9000/admin/products/prod_1?fields=id%2Csales_channels.id",
    );
    assert.equal(forwardedRequests[1]?.method, "POST");
    assert.equal(forwardedRequests[1]?.url, "http://medusa:9000/admin/products/prod_1");
    assert.deepEqual(await forwardedRequests[1]?.json(), {
      title: "Updated coffee",
      status: "published",
      thumbnail: "https://cdn.test/coffee.jpg",
    });
    assert.deepEqual(result, {
      ok: true,
      product: {
        id: "prod_1",
        title: "Updated coffee",
        handle: "coffee",
        status: "published",
        thumbnail: "https://cdn.test/coffee.jpg",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    });
  });

  it("does not update products outside the resolved tenant sales channel", async () => {
    const forwardedRequests: Request[] = [];
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        return Response.json({
          product: {
            id: "prod_1",
            sales_channels: [{ id: "sc_other" }],
          },
        });
      },
    });

    const result = await service.updateMerchantProduct({
      productId: "prod_1",
      title: "Updated coffee",
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "product_not_found",
      status: 404,
    });
    assert.equal(forwardedRequests.length, 1);
  });

  it("lists products through the Medusa Admin API scoped by sales channel", async () => {
    let forwardedRequest: Request | undefined;
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          products: [
            {
              id: "prod_1",
              title: "Coffee",
              handle: "coffee",
              status: "published",
              thumbnail: null,
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
            },
          ],
          count: 1,
          limit: 5,
          offset: 10,
        });
      },
    });

    const result = await service.listMerchantProducts({
      limit: 5,
      offset: 10,
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.headers.get("x-medusa-access-token"), "medusa_token");

    const url = new URL(forwardedRequest.url);
    assert.equal(
      url.href,
      "http://medusa:9000/admin/products?limit=5&offset=10&order=-created_at&fields=id%2Ctitle%2Chandle%2Cstatus%2Cthumbnail%2Ccreated_at%2Cupdated_at%2Csales_channels.id&sales_channel_id%5B%5D=sc_1",
    );
    assert.deepEqual(result, {
      ok: true,
      products: [
        {
          id: "prod_1",
          title: "Coffee",
          handle: "coffee",
          status: "published",
          thumbnail: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 1,
      limit: 5,
      offset: 10,
    });
  });

  it("fails closed when the Medusa admin token is missing", async () => {
    let calls = 0;
    const service = createMedusaProductService({
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => {
        calls += 1;
        return Response.json({});
      },
    });

    const result = await service.listMerchantProducts({
      limit: 20,
      offset: 0,
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "commerce_credentials_missing",
      status: 503,
    });
    assert.equal(calls, 0);
  });
});
