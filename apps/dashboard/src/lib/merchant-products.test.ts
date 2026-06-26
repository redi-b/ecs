import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMerchantProduct,
  getMerchantProducts,
  updateMerchantProduct,
} from "./merchant-products.js";

describe("getMerchantProducts", () => {
  it("creates merchant products with session and host context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await createMerchantProduct({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "abebe.lvh.me",
      product: {
        title: "Coffee",
        handle: "coffee",
        status: "draft",
        thumbnail: null,
      },
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
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
      },
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequest?.method, "POST");
    assert.equal(forwardedRequest?.url, "http://platform.local/platform/merchant/products");
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    assert.deepEqual(await forwardedRequest?.json(), {
      title: "Coffee",
      handle: "coffee",
      status: "draft",
      thumbnail: null,
    });
  });

  it("updates merchant products with session and host context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await updateMerchantProduct({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "abebe.lvh.me",
      productId: "prod_1",
      product: {
        title: "Updated coffee",
        handle: "updated-coffee",
        status: "published",
        thumbnail: "https://cdn.test/coffee.jpg",
      },
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          product: {
            id: "prod_1",
            title: "Updated coffee",
            handle: "updated-coffee",
            status: "published",
            thumbnail: "https://cdn.test/coffee.jpg",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-03T00:00:00.000Z",
          },
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequest?.method, "POST");
    assert.equal(forwardedRequest?.url, "http://platform.local/platform/merchant/products/prod_1");
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    assert.deepEqual(await forwardedRequest?.json(), {
      title: "Updated coffee",
      handle: "updated-coffee",
      status: "published",
      thumbnail: "https://cdn.test/coffee.jpg",
    });
  });

  it("fetches merchant products with session and host context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantProducts({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "abebe.lvh.me",
      limit: 5,
      offset: 10,
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
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
          count: 1,
          limit: 5,
          offset: 10,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/merchant/products?limit=5&offset=10",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  });

  it("returns an error for invalid product responses", async () => {
    const result = await getMerchantProducts({
      platformApiBaseUrl: "http://platform.local",
      fetcher: async () => Response.json({ products: null }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 502,
      message: "invalid_products_response",
    });
  });
});
