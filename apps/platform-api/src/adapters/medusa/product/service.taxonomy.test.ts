import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMedusaProductService } from "./service.js";
import { getProductsUrl, PRODUCT_LIST_FIELDS } from "./urls.js";

describe("createMedusaProductService: product taxonomy and authentication", () => {
  it("creates product categories with tenant metadata", async () => {
    let forwardedRequest: Request | undefined;
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          product_category: {
            id: "pcat_1",
            name: "Coffee",
            handle: "coffee",
            is_active: true,
            is_internal: false,
            parent_category_id: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.createMerchantProductCategory({
      name: "Coffee",
      handle: "coffee",
      tenantId: "tenant_1",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/admin/product-categories");
    assert.deepEqual(await forwardedRequest.json(), {
      name: "Coffee",
      handle: "coffee",
      is_active: true,
      is_internal: false,
      metadata: {
        platform_tenant_id: "tenant_1",
      },
    });
    assert.deepEqual(result, {
      ok: true,
      category: {
        id: "pcat_1",
        name: "Coffee",
        handle: "coffee",
        isActive: true,
        isInternal: false,
        parentCategoryId: null,
        rank: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("lists product categories scoped by tenant metadata", async () => {
    let forwardedRequest: Request | undefined;
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          product_categories: [
            {
              id: "pcat_1",
              name: "Coffee",
              handle: "coffee",
              is_active: true,
              is_internal: false,
              parent_category_id: null,
              metadata: {
                platform_tenant_id: "tenant_1",
              },
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
            },
          ],
          count: 11,
          limit: 5,
          offset: 10,
        });
      },
    });

    const result = await service.listMerchantProductCategories({
      limit: 5,
      offset: 10,
      tenantId: "tenant_1",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);

    const url = new URL(forwardedRequest.url);
    assert.equal(
      url.href,
      "http://medusa:9000/admin/platform-taxonomy?tenant_id=tenant_1&kind=categories&limit=5&offset=10",
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
          rank: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 11,
      limit: 5,
      offset: 10,
    });
  });

  it("creates product collections with tenant metadata", async () => {
    let forwardedRequest: Request | undefined;
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          collection: {
            id: "pcol_1",
            title: "Featured",
            handle: "featured",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.createMerchantProductCollection({
      title: "Featured",
      handle: "featured",
      tenantId: "tenant_1",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/admin/collections");
    assert.deepEqual(await forwardedRequest.json(), {
      title: "Featured",
      handle: "featured",
      metadata: {
        platform_tenant_id: "tenant_1",
      },
    });
    assert.deepEqual(result, {
      ok: true,
      collection: {
        id: "pcol_1",
        title: "Featured",
        handle: "featured",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("lists product collections scoped by tenant metadata", async () => {
    let forwardedRequest: Request | undefined;
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          collections: [
            {
              id: "pcol_1",
              title: "Featured",
              handle: "featured",
              metadata: {
                platform_tenant_id: "tenant_1",
              },
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
            },
          ],
          count: 11,
          limit: 5,
          offset: 10,
        });
      },
    });

    const result = await service.listMerchantProductCollections({
      limit: 5,
      offset: 10,
      tenantId: "tenant_1",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);

    const url = new URL(forwardedRequest.url);
    assert.equal(
      url.href,
      "http://medusa:9000/admin/platform-taxonomy?tenant_id=tenant_1&kind=collections&limit=5&offset=10",
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
      count: 11,
      limit: 5,
      offset: 10,
    });
  });

  it("forwards image filters and pagination together with native catalog filters", async () => {
    for (const media of ["with_media", "without_media"] as const) {
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async (input) => {
          const url = new URL(String(input));
          assert.equal(url.pathname, "/admin/platform-products");
          assert.equal(url.searchParams.get("media"), media);
          assert.equal(url.searchParams.get("sales_channel_id[]"), "sc_1");
          assert.equal(url.searchParams.get("status[]"), "published");
          assert.equal(url.searchParams.get("category_id[]"), "cat_1");
          assert.equal(url.searchParams.get("collection_id[]"), "col_1");
          assert.equal(url.searchParams.get("q"), "coffee");
          assert.equal(url.searchParams.get("offset"), "20");
          assert.equal(url.searchParams.get("limit"), "10");
          return Response.json({ products: [], count: 20, offset: 20, limit: 10 });
        },
      });
      const result = await service.listMerchantProducts({
        media,
        salesChannelId: "sc_1",
        status: "published",
        categoryId: "cat_1",
        collectionId: "col_1",
        q: "coffee",
        offset: 20,
        limit: 10,
      });
      assert.deepEqual(result, { ok: true, products: [], count: 20, offset: 20, limit: 10 });
    }
  });

  it("rejects taxonomy responses containing another tenant's records", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () =>
        Response.json({
          product_categories: [
            { id: "foreign_category", metadata: { platform_tenant_id: "tenant_other" } },
          ],
          collections: [
            { id: "foreign_collection", metadata: { platform_tenant_id: "tenant_other" } },
          ],
          count: 1,
          limit: 100,
          offset: 0,
        }),
    });
    const input = { tenantId: "tenant_1", limit: 100, offset: 0 };
    assert.deepEqual(await service.listMerchantProductCategories(input), {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    });
    assert.deepEqual(await service.listMerchantProductCollections(input), {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
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

  it("returns invalid credentials when Medusa rejects the configured admin token", async () => {
    const service = createMedusaProductService({
      adminApiToken: "stale_medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => Response.json({}, { status: 401 }),
    });

    const result = await service.listMerchantProducts({
      limit: 20,
      offset: 0,
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    });
  });

  describe("delete merchant catalog resources", () => {
    it("deletes a single product after verifying sales channel ownership", async () => {
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

          if (request.method === "DELETE") {
            return Response.json({
              id: "prod_1",
              object: "product",
              deleted: true,
            });
          }

          return Response.json({}, { status: 400 });
        },
      });

      const result = await (service as any).deleteMerchantProduct({
        productId: "prod_1",
        salesChannelId: "sc_1",
      });

      assert.deepEqual(result, {
        ok: true,
        id: "prod_1",
        deleted: true,
      });

      assert.equal(forwardedRequests.length, 2);
      assert.equal(
        forwardedRequests[0]?.url,
        "http://medusa:9000/admin/products/prod_1?fields=id%2Csales_channels.id",
      );
      assert.equal(forwardedRequests[0]?.method, "GET");
      assert.equal(forwardedRequests[0]?.headers.get("authorization"), "Basic medusa_token");

      assert.equal(forwardedRequests[1]?.url, "http://medusa:9000/admin/products/prod_1");
      assert.equal(forwardedRequests[1]?.method, "DELETE");
      assert.equal(forwardedRequests[1]?.headers.get("authorization"), "Basic medusa_token");
    });

    it("does not delete a product outside the sales channel", async () => {
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

      const result = await (service as any).deleteMerchantProduct({
        productId: "prod_1",
        salesChannelId: "sc_1",
      });

      assert.deepEqual(result, {
        ok: false,
        error: "product_not_found",
        status: 404,
      });
      assert.equal(forwardedRequests.length, 1);
    });

    it("batch deletes products scoped to the sales channel", async () => {
      const forwardedRequests: Request[] = [];
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          forwardedRequests.push(request);

          if (request.method === "GET") {
            return Response.json({
              products: [{ id: "prod_1" }, { id: "prod_2" }],
            });
          }

          if (request.method === "POST") {
            return Response.json({
              deleted: ["prod_1", "prod_2"],
            });
          }

          return Response.json({}, { status: 400 });
        },
      });

      const result = await (service as any).deleteMerchantProductsBatch({
        productIds: ["prod_1", "prod_2", "prod_other"],
        salesChannelId: "sc_1",
      });

      assert.deepEqual(result, {
        ok: true,
        ids: ["prod_1", "prod_2"],
        deleted: true,
      });

      assert.equal(forwardedRequests.length, 2);
      assert.equal(forwardedRequests[0]?.method, "GET");
      const filterUrl = new URL(forwardedRequests[0]!.url);
      assert.equal(filterUrl.searchParams.get("sales_channel_id[]"), "sc_1");
      assert.deepEqual(filterUrl.searchParams.getAll("id[]"), ["prod_1", "prod_2", "prod_other"]);

      assert.equal(forwardedRequests[1]?.method, "POST");
      assert.equal(forwardedRequests[1]?.url, "http://medusa:9000/admin/products/batch");
      assert.deepEqual(await forwardedRequests[1]!.json(), {
        delete: ["prod_1", "prod_2"],
      });
    });

    it("deletes a product category after verifying tenant ownership", async () => {
      const forwardedRequests: Request[] = [];
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          forwardedRequests.push(request);

          if (request.method === "GET") {
            return Response.json({
              product_category: {
                id: "pcat_1",
                metadata: {
                  platform_tenant_id: "tenant_1",
                },
              },
            });
          }

          if (request.method === "DELETE") {
            return Response.json({
              id: "pcat_1",
              object: "product-category",
              deleted: true,
            });
          }

          return Response.json({}, { status: 400 });
        },
      });

      const result = await (service as any).deleteMerchantProductCategory({
        categoryId: "pcat_1",
        tenantId: "tenant_1",
      });

      assert.deepEqual(result, {
        ok: true,
        id: "pcat_1",
        deleted: true,
      });

      assert.equal(forwardedRequests.length, 2);
      assert.equal(
        forwardedRequests[0]?.url,
        "http://medusa:9000/admin/product-categories/pcat_1?fields=id%2Cmetadata",
      );
      assert.equal(forwardedRequests[1]?.url, "http://medusa:9000/admin/product-categories/pcat_1");
      assert.equal(forwardedRequests[1]?.method, "DELETE");
    });

    it("does not delete category belonging to another tenant", async () => {
      const forwardedRequests: Request[] = [];
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          forwardedRequests.push(request);

          return Response.json({
            product_category: {
              id: "pcat_1",
              metadata: {
                platform_tenant_id: "tenant_other",
              },
            },
          });
        },
      });

      const result = await (service as any).deleteMerchantProductCategory({
        categoryId: "pcat_1",
        tenantId: "tenant_1",
      });

      assert.deepEqual(result, {
        ok: false,
        error: "category_not_found",
        status: 404,
      });
      assert.equal(forwardedRequests.length, 1);
    });

    it("batch deletes categories in parallel via Promise.all", async () => {
      const forwardedRequests: Request[] = [];
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          forwardedRequests.push(request);

          if (request.method === "GET") {
            const url = new URL(request.url);
            const id = url.pathname.split("/").pop();
            return Response.json({
              product_category: {
                id,
                metadata: {
                  platform_tenant_id: "tenant_1",
                },
              },
            });
          }

          if (request.method === "DELETE") {
            const url = new URL(request.url);
            const id = url.pathname.split("/").pop();
            return Response.json({
              id,
              object: "product-category",
              deleted: true,
            });
          }

          return Response.json({}, { status: 400 });
        },
      });

      const result = await (service as any).deleteMerchantProductCategoriesBatch({
        categoryIds: ["pcat_1", "pcat_2"],
        tenantId: "tenant_1",
      });

      assert.deepEqual(result, {
        ok: true,
        ids: ["pcat_1", "pcat_2"],
        deleted: true,
      });

      assert.equal(forwardedRequests.length, 4); // 2 GETs + 2 DELETEs
    });

    it("deletes a product collection after verifying tenant ownership", async () => {
      const forwardedRequests: Request[] = [];
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          forwardedRequests.push(request);

          if (request.method === "GET") {
            return Response.json({
              collection: {
                id: "pcol_1",
                metadata: {
                  platform_tenant_id: "tenant_1",
                },
              },
            });
          }

          if (request.method === "DELETE") {
            return Response.json({
              id: "pcol_1",
              object: "product-collection",
              deleted: true,
            });
          }

          return Response.json({}, { status: 400 });
        },
      });

      const result = await (service as any).deleteMerchantProductCollection({
        collectionId: "pcol_1",
        tenantId: "tenant_1",
      });

      assert.deepEqual(result, {
        ok: true,
        id: "pcol_1",
        deleted: true,
      });

      assert.equal(forwardedRequests.length, 2);
      assert.equal(
        forwardedRequests[0]?.url,
        "http://medusa:9000/admin/collections/pcol_1?fields=id%2Cmetadata",
      );
      assert.equal(forwardedRequests[1]?.url, "http://medusa:9000/admin/collections/pcol_1");
      assert.equal(forwardedRequests[1]?.method, "DELETE");
    });

    it("does not delete collection belonging to another tenant", async () => {
      const forwardedRequests: Request[] = [];
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          forwardedRequests.push(request);

          return Response.json({
            collection: {
              id: "pcol_1",
              metadata: {
                platform_tenant_id: "tenant_other",
              },
            },
          });
        },
      });

      const result = await (service as any).deleteMerchantProductCollection({
        collectionId: "pcol_1",
        tenantId: "tenant_1",
      });

      assert.deepEqual(result, {
        ok: false,
        error: "collection_not_found",
        status: 404,
      });
      assert.equal(forwardedRequests.length, 1);
    });

    it("batch deletes collections in parallel via Promise.all", async () => {
      const forwardedRequests: Request[] = [];
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          forwardedRequests.push(request);

          if (request.method === "GET") {
            const url = new URL(request.url);
            const id = url.pathname.split("/").pop();
            return Response.json({
              collection: {
                id,
                metadata: {
                  platform_tenant_id: "tenant_1",
                },
              },
            });
          }

          if (request.method === "DELETE") {
            const url = new URL(request.url);
            const id = url.pathname.split("/").pop();
            return Response.json({
              id,
              object: "product-collection",
              deleted: true,
            });
          }

          return Response.json({}, { status: 400 });
        },
      });

      const result = await (service as any).deleteMerchantProductCollectionsBatch({
        collectionIds: ["pcol_1", "pcol_2"],
        tenantId: "tenant_1",
      });

      assert.deepEqual(result, {
        ok: true,
        ids: ["pcol_1", "pcol_2"],
        deleted: true,
      });

      assert.equal(forwardedRequests.length, 4); // 2 GETs + 2 DELETEs
    });

    it("deleteMerchantProduct propagates retrieval errors directly (like 503)", async () => {
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async () => Response.json({}, { status: 503 }),
      });

      const result = await (service as any).deleteMerchantProduct({
        productId: "prod_1",
        salesChannelId: "sc_1",
      });

      assert.deepEqual(result, {
        ok: false,
        error: "commerce_backend_unavailable",
        status: 503,
      });
    });

    it("deleteMerchantProductCategoriesBatch propagates verification errors directly (like 503)", async () => {
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async () => Response.json({}, { status: 503 }),
      });

      const result = await (service as any).deleteMerchantProductCategoriesBatch({
        categoryIds: ["pcat_1", "pcat_2"],
        tenantId: "tenant_1",
      });

      assert.deepEqual(result, {
        ok: false,
        error: "commerce_backend_unavailable",
        status: 503,
      });
    });

    it("deleteMerchantProductCategoriesBatch propagates individual deletion errors directly (like 503)", async () => {
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          if (request.method === "GET") {
            return Response.json({
              product_category: {
                id: "pcat_1",
                metadata: {
                  platform_tenant_id: "tenant_1",
                },
              },
            });
          }
          return Response.json({}, { status: 503 });
        },
      });

      const result = await (service as any).deleteMerchantProductCategoriesBatch({
        categoryIds: ["pcat_1"],
        tenantId: "tenant_1",
      });

      assert.deepEqual(result, {
        ok: false,
        error: "commerce_backend_unavailable",
        status: 503,
      });
    });

    it("deleteMerchantProductCollectionsBatch propagates verification errors directly (like 503)", async () => {
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async () => Response.json({}, { status: 503 }),
      });

      const result = await (service as any).deleteMerchantProductCollectionsBatch({
        collectionIds: ["pcol_1", "pcol_2"],
        tenantId: "tenant_1",
      });

      assert.deepEqual(result, {
        ok: false,
        error: "commerce_backend_unavailable",
        status: 503,
      });
    });

    it("deleteMerchantProductCollectionsBatch propagates individual deletion errors directly (like 503)", async () => {
      const service = createMedusaProductService({
        adminApiToken: "medusa_token",
        medusaInternalUrl: "http://medusa:9000",
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          if (request.method === "GET") {
            return Response.json({
              collection: {
                id: "pcol_1",
                metadata: {
                  platform_tenant_id: "tenant_1",
                },
              },
            });
          }
          return Response.json({}, { status: 503 });
        },
      });

      const result = await (service as any).deleteMerchantProductCollectionsBatch({
        collectionIds: ["pcol_1"],
        tenantId: "tenant_1",
      });

      assert.deepEqual(result, {
        ok: false,
        error: "commerce_backend_unavailable",
        status: 503,
      });
    });
  });
});
