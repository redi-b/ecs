import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMerchantProductCategory,
  createMerchantProductCollection,
  createMerchantProduct,
  getMerchantProduct,
  getMerchantProductCategories,
  getMerchantProductCollections,
  getMerchantProductStock,
  getMerchantProductVariantStock,
  getMerchantProducts,
  updateMerchantProductStock,
  updateMerchantProductVariantStock,
  updateMerchantProduct,
  deleteMerchantProduct,
  deleteMerchantProductsBatch,
  deleteMerchantProductCategory,
  deleteMerchantProductCategoriesBatch,
  deleteMerchantProductCollection,
  deleteMerchantProductCollectionsBatch,
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

const merchantProductCategory = {
  id: "pcat_1",
  name: "Coffee",
  handle: "coffee",
  isActive: true,
  isInternal: false,
  parentCategoryId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const merchantProductCollection = {
  id: "pcol_1",
  title: "Featured",
  handle: "featured",
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

const merchantProductStock = {
  productId: "prod_1",
  variantId: "variant_1",
  inventoryItemId: "iitem_1",
  locationId: "sloc_1",
  stockedQuantity: 12,
  reservedQuantity: 2,
  incomingQuantity: 0,
  availableQuantity: 10,
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

  it("creates merchant product categories with tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await createMerchantProductCategory({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      name: "Coffee",
      handle: "coffee",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          category: merchantProductCategory,
        });
      },
    });

    assert.deepEqual(result, {
      ok: true,
      category: merchantProductCategory,
    });
    assert.equal(forwardedRequest?.method, "POST");
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/product-categories",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), null);
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    assert.equal(forwardedRequest?.headers.get("content-type"), "application/json");
    assert.deepEqual(await forwardedRequest?.json(), {
      name: "Coffee",
      handle: "coffee",
    });
  });

  it("creates merchant product categories with resolved shop host context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await createMerchantProductCategory({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "abebe.lvh.me",
      name: "Coffee",
      handle: "coffee",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          category: merchantProductCategory,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/merchant/product-categories",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  });

  it("returns an error for invalid merchant product category create responses", async () => {
    const result = await createMerchantProductCategory({
      platformApiBaseUrl: "http://platform.local",
      name: "Coffee",
      fetcher: async () => Response.json({ category: null }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 502,
      message: "invalid_product_category_response",
    });
  });

  it("returns an error when merchant product category create requests fail", async () => {
    const result = await createMerchantProductCategory({
      platformApiBaseUrl: "http://platform.local",
      name: "Coffee",
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

  it("creates merchant product collections with tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await createMerchantProductCollection({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      title: "Featured",
      handle: "featured",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          collection: merchantProductCollection,
        });
      },
    });

    assert.deepEqual(result, {
      ok: true,
      collection: merchantProductCollection,
    });
    assert.equal(forwardedRequest?.method, "POST");
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/product-collections",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), null);
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    assert.equal(forwardedRequest?.headers.get("content-type"), "application/json");
    assert.deepEqual(await forwardedRequest?.json(), {
      title: "Featured",
      handle: "featured",
    });
  });

  it("creates merchant product collections with resolved shop host context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await createMerchantProductCollection({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "abebe.lvh.me",
      title: "Featured",
      handle: "featured",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          collection: merchantProductCollection,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/merchant/product-collections",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  });

  it("returns an error for invalid merchant product collection create responses", async () => {
    const result = await createMerchantProductCollection({
      platformApiBaseUrl: "http://platform.local",
      title: "Featured",
      fetcher: async () => Response.json({ collection: null }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 502,
      message: "invalid_product_collection_response",
    });
  });

  it("returns an error when merchant product collection create requests fail", async () => {
    const result = await createMerchantProductCollection({
      platformApiBaseUrl: "http://platform.local",
      title: "Featured",
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
          categories: [
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
            {
              id: "pcat_2",
              name: "Archived",
              handle: "archived",
              isActive: null,
              isInternal: null,
              parentCategoryId: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
          count: 2,
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
      categories: [
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
        {
          id: "pcat_2",
          name: "Archived",
          handle: "archived",
          isActive: null,
          isInternal: null,
          parentCategoryId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 2,
      limit: 100,
      offset: 0,
    });
  });

  it("fetches merchant product categories with resolved shop host context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantProductCategories({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "abebe.lvh.me",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          categories: [],
          count: 0,
          limit: 100,
          offset: 0,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/merchant/product-categories?limit=100&offset=0",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  });

  it("fetches merchant product collections with tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantProductCollections({
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          collections: [
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
      collections: [
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

  it("fetches merchant product collections with resolved shop host context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantProductCollections({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "abebe.lvh.me",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          collections: [],
          count: 0,
          limit: 100,
          offset: 0,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/merchant/product-collections?limit=100&offset=0",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
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

  it("fetches merchant product stock with tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantProductStock({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      productId: "prod_1",
      tenantId: "tenant_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          stock: merchantProductStock,
        });
      },
    });

    assert.deepEqual(result, {
      ok: true,
      stock: merchantProductStock,
    });
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/products/prod_1/stock",
    );
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), null);
  });

  it("updates merchant product stock with resolved shop host context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await updateMerchantProductStock({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      productId: "prod_1",
      requestHost: "abebe.lvh.me",
      stockedQuantity: 15,
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          stock: {
            ...merchantProductStock,
            stockedQuantity: 15,
            availableQuantity: 13,
          },
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/merchant/products/prod_1/stock",
    );
    assert.equal(forwardedRequest?.method, "POST");
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
    assert.deepEqual(await forwardedRequest?.json(), {
      stockedQuantity: 15,
    });
  });

  it("fetches merchant product variant stock with tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantProductVariantStock({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      productId: "prod_1",
      tenantId: "tenant_1",
      variantId: "variant_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          stock: merchantProductStock,
        });
      },
    });

    assert.deepEqual(result, {
      ok: true,
      stock: merchantProductStock,
    });
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/products/prod_1/variants/variant_1/stock",
    );
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), null);
  });

  it("updates merchant product variant stock with resolved shop host context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await updateMerchantProductVariantStock({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      productId: "prod_1",
      requestHost: "abebe.lvh.me",
      stockedQuantity: 18,
      variantId: "variant_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          stock: {
            ...merchantProductStock,
            stockedQuantity: 18,
            availableQuantity: 16,
          },
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/merchant/products/prod_1/variants/variant_1/stock",
    );
    assert.equal(forwardedRequest?.method, "POST");
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
    assert.deepEqual(await forwardedRequest?.json(), {
      stockedQuantity: 18,
    });
  });

  it("returns an error for invalid merchant product stock responses", async () => {
    const result = await getMerchantProductStock({
      platformApiBaseUrl: "http://platform.local",
      productId: "prod_1",
      fetcher: async () => Response.json({ stock: null }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 502,
      message: "invalid_product_stock_response",
    });
  });

  describe("delete merchant catalog resources", () => {
    it("deletes a single product with tenant context", async () => {
      let forwardedRequest: Request | undefined;
      const result = await deleteMerchantProduct({
        cookieHeader: "better-auth.session_token=session_1",
        platformApiBaseUrl: "http://platform.local",
        productId: "prod_1",
        tenantId: "tenant_1",
        fetcher: async (input, init) => {
          forwardedRequest = new Request(input, init);
          return Response.json({ id: "prod_1", deleted: true });
        },
      });

      assert.deepEqual(result, { ok: true, id: "prod_1", deleted: true });
      assert.equal(forwardedRequest?.method, "DELETE");
      assert.equal(
        forwardedRequest?.url,
        "http://platform.local/platform/tenants/tenant_1/products/prod_1",
      );
      assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    });

    it("batch deletes products with host context", async () => {
      let forwardedRequest: Request | undefined;
      const result = await deleteMerchantProductsBatch({
        cookieHeader: "better-auth.session_token=session_1",
        platformApiBaseUrl: "http://platform.local",
        productIds: ["prod_1", "prod_2"],
        requestHost: "abebe.lvh.me",
        fetcher: async (input, init) => {
          forwardedRequest = new Request(input, init);
          return Response.json({ ids: ["prod_1", "prod_2"], deleted: true });
        },
      });

      assert.deepEqual(result, { ok: true, ids: ["prod_1", "prod_2"], deleted: true });
      assert.equal(forwardedRequest?.method, "POST");
      assert.equal(
        forwardedRequest?.url,
        "http://platform.local/platform/merchant/products/batch-delete",
      );
      assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
      assert.deepEqual(await forwardedRequest?.json(), { productIds: ["prod_1", "prod_2"] });
    });

    it("deletes a single product category", async () => {
      let forwardedRequest: Request | undefined;
      const result = await deleteMerchantProductCategory({
        platformApiBaseUrl: "http://platform.local",
        categoryId: "pcat_1",
        fetcher: async (input, init) => {
          forwardedRequest = new Request(input, init);
          return Response.json({ id: "pcat_1", deleted: true });
        },
      });

      assert.deepEqual(result, { ok: true, id: "pcat_1", deleted: true });
      assert.equal(forwardedRequest?.method, "DELETE");
      assert.equal(
        forwardedRequest?.url,
        "http://platform.local/platform/merchant/product-categories/pcat_1",
      );
    });

    it("batch deletes product categories", async () => {
      let forwardedRequest: Request | undefined;
      const result = await deleteMerchantProductCategoriesBatch({
        platformApiBaseUrl: "http://platform.local",
        categoryIds: ["pcat_1", "pcat_2"],
        tenantId: "tenant_1",
        fetcher: async (input, init) => {
          forwardedRequest = new Request(input, init);
          return Response.json({ ids: ["pcat_1", "pcat_2"], deleted: true });
        },
      });

      assert.deepEqual(result, { ok: true, ids: ["pcat_1", "pcat_2"], deleted: true });
      assert.equal(forwardedRequest?.method, "POST");
      assert.equal(
        forwardedRequest?.url,
        "http://platform.local/platform/tenants/tenant_1/product-categories/batch-delete",
      );
      assert.deepEqual(await forwardedRequest?.json(), { categoryIds: ["pcat_1", "pcat_2"] });
    });

    it("deletes a single product collection", async () => {
      let forwardedRequest: Request | undefined;
      const result = await deleteMerchantProductCollection({
        platformApiBaseUrl: "http://platform.local",
        collectionId: "pcol_1",
        fetcher: async (input, init) => {
          forwardedRequest = new Request(input, init);
          return Response.json({ id: "pcol_1", deleted: true });
        },
      });

      assert.deepEqual(result, { ok: true, id: "pcol_1", deleted: true });
      assert.equal(forwardedRequest?.method, "DELETE");
      assert.equal(
        forwardedRequest?.url,
        "http://platform.local/platform/merchant/product-collections/pcol_1",
      );
    });

    it("batch deletes product collections", async () => {
      let forwardedRequest: Request | undefined;
      const result = await deleteMerchantProductCollectionsBatch({
        platformApiBaseUrl: "http://platform.local",
        collectionIds: ["pcol_1", "pcol_2"],
        fetcher: async (input, init) => {
          forwardedRequest = new Request(input, init);
          return Response.json({ ids: ["pcol_1", "pcol_2"], deleted: true });
        },
      });

      assert.deepEqual(result, { ok: true, ids: ["pcol_1", "pcol_2"], deleted: true });
      assert.equal(forwardedRequest?.method, "POST");
      assert.equal(
        forwardedRequest?.url,
        "http://platform.local/platform/merchant/product-collections/batch-delete",
      );
      assert.deepEqual(await forwardedRequest?.json(), { collectionIds: ["pcol_1", "pcol_2"] });
    });

    it("handles non-2xx platform errors", async () => {
      const result = await deleteMerchantProduct({
        platformApiBaseUrl: "http://platform.local",
        productId: "prod_1",
        fetcher: async () => {
          return new Response(JSON.stringify({ error: "product_not_found" }), {
            status: 404,
            statusText: "Not Found",
          });
        },
      });

      assert.deepEqual(result, {
        ok: false,
        status: 404,
        message: "This product could not be found.",
      });
    });

    it("handles fetch network failure", async () => {
      const result = await deleteMerchantProduct({
        platformApiBaseUrl: "http://platform.local",
        productId: "prod_1",
        fetcher: async () => {
          throw new TypeError("Failed to fetch");
        },
      });

      assert.deepEqual(result, {
        ok: false,
        status: 503,
        message: "platform_request_failed",
      });
    });

    it("handles invalid response schema parsing failure", async () => {
      const result = await deleteMerchantProduct({
        platformApiBaseUrl: "http://platform.local",
        productId: "prod_1",
        fetcher: async () => {
          return Response.json({ wrong_key: "abc" });
        },
      });

      assert.deepEqual(result, {
        ok: false,
        status: 502,
        message: "invalid_product_delete_response",
      });
    });
  });
});
