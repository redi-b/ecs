import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMerchantProduct,
  getMerchantProduct,
  getMerchantProductCategories,
  getMerchantProductCollections,
  getMerchantProducts,
  updateMerchantProduct,
} from "./merchant-products.js";

const merchantProduct = {
  id: "prod_1",
  title: "Coffee",
  description: "Roasted coffee beans",
  handle: "coffee",
  collectionId: "pcol_1",
  categoryIds: ["pcat_1"],
  status: "draft",
  thumbnail: "https://cdn.test/thumb.jpg",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const productWriteBody = {
  title: "Coffee",
  description: "Roasted coffee beans",
  handle: "coffee",
  collectionId: "pcol_1",
  categoryIds: ["pcat_1"],
  imageUrls: ["https://cdn.test/coffee.jpg"],
  priceAmount: 350,
  currencyCode: "etb",
  status: "draft",
  thumbnail: "https://cdn.test/thumb.jpg",
};

describe("getMerchantProducts", () => {
  it("creates merchant products with session and tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await createMerchantProduct({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      product: productWriteBody,
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          product: merchantProduct,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequest?.method, "POST");
    assert.equal(forwardedRequest?.url, "http://platform.local/platform/tenants/tenant_1/products");
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), null);
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    assert.deepEqual(await forwardedRequest?.json(), productWriteBody);
  });

  it("updates merchant products with session and tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await updateMerchantProduct({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      productId: "prod_1",
      product: productWriteBody,
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          product: merchantProduct,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequest?.method, "POST");
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/products/prod_1",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), null);
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    assert.deepEqual(await forwardedRequest?.json(), productWriteBody);
  });

  it("fetches a merchant product with session and tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantProduct({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      productId: "prod_1",
      tenantId: "tenant_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          product: merchantProduct,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/products/prod_1",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), null);
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    assert.deepEqual(result, {
      ok: true,
      product: merchantProduct,
    });
  });

  it("fetches merchant product categories with tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantProductCategories({
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          productCategories: [
            {
              id: "pcat_1",
              name: "Coffee",
              handle: "coffee",
              isActive: true,
              isInternal: false,
              parentCategoryId: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
          count: 1,
          limit: 100,
          offset: 0,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/product-categories?limit=100&offset=0",
    );
    assert.deepEqual(result, {
      ok: true,
      productCategories: [
        {
          id: "pcat_1",
          name: "Coffee",
          handle: "coffee",
          isActive: true,
          isInternal: false,
          parentCategoryId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 1,
      limit: 100,
      offset: 0,
    });
  });

  it("fetches merchant product collections with tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantProductCollections({
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          productCollections: [
            {
              id: "pcol_1",
              title: "Featured",
              handle: "featured",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
          count: 1,
          limit: 100,
          offset: 0,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/product-collections?limit=100&offset=0",
    );
    assert.deepEqual(result, {
      ok: true,
      productCollections: [
        {
          id: "pcol_1",
          title: "Featured",
          handle: "featured",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 1,
      limit: 100,
      offset: 0,
    });
  });

  it("fetches merchant products with session and tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantProducts({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
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
      "http://platform.local/platform/tenants/tenant_1/products?limit=5&offset=10",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), null);
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

  it("returns an error when the product request fails", async () => {
    const result = await getMerchantProducts({
      platformApiBaseUrl: "http://platform.local",
      fetcher: async () => {
        throw new TypeError("fetch failed");
      },
    });

    assert.deepEqual(result, {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    });
  });
});
