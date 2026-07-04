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
            description: "Roasted coffee beans",
            handle: "coffee",
            collection_id: "pcol_1",
            categories: [{ id: "pcat_1" }],
            images: [
              {
                id: "img_1",
                url: "https://cdn.test/coffee-1.jpg",
                rank: 0,
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ],
            variants: [
              {
                id: "variant_1",
                title: "Default",
                sku: null,
                prices: [{ amount: 350, currency_code: "etb" }],
              },
            ],
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
      description: "Roasted coffee beans",
      handle: "coffee",
      collectionId: "pcol_1",
      categoryIds: ["pcat_1"],
      imageUrls: ["https://cdn.test/coffee-1.jpg"],
      priceAmount: 350,
      currencyCode: "ETB",
      regionId: "reg_1",
      status: "draft",
      thumbnail: null,
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/admin/products");
    assert.equal(forwardedRequest.headers.get("authorization"), "Basic medusa_token");
    assert.equal(forwardedRequest.headers.get("content-type"), "application/json");
    assert.deepEqual(await forwardedRequest.json(), {
      title: "Coffee",
      description: "Roasted coffee beans",
      handle: "coffee",
      collection_id: "pcol_1",
      categories: [{ id: "pcat_1" }],
      images: [{ url: "https://cdn.test/coffee-1.jpg" }],
      options: [
        {
          title: "Default",
          values: ["Default"],
        },
      ],
      variants: [
        {
          title: "Default",
          options: {
            Default: "Default",
          },
          prices: [
            {
              amount: 350,
              currency_code: "etb",
              rules: {
                region_id: "reg_1",
              },
            },
          ],
        },
      ],
      status: "draft",
      sales_channels: [{ id: "sc_1" }],
    });
    assert.deepEqual(result, {
      ok: true,
      product: {
        id: "prod_1",
        categoryIds: ["pcat_1"],
        collectionId: "pcol_1",
        description: "Roasted coffee beans",
        title: "Coffee",
        handle: "coffee",
        status: "draft",
        thumbnail: null,
        images: [
          {
            id: "img_1",
            url: "https://cdn.test/coffee-1.jpg",
            rank: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        variants: [
          {
            id: "variant_1",
            inventoryItemId: null,
            title: "Default",
            sku: null,
            prices: [
              {
                amount: 350,
                currencyCode: "etb",
              },
            ],
          },
        ],
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
        categoryIds: [],
        collectionId: null,
        description: null,
        title: "Updated coffee",
        handle: "coffee",
        status: "published",
        thumbnail: "https://cdn.test/coffee.jpg",
        variants: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    });
  });

  it("gets a product only when it belongs to the resolved tenant sales channel", async () => {
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
            description: "Roasted coffee beans",
            handle: "coffee",
            collection_id: "pcol_1",
            categories: [{ id: "pcat_1" }],
            sales_channels: [{ id: "sc_1" }],
            images: [
              {
                id: "img_1",
                url: "https://cdn.test/coffee-1.jpg",
                rank: 0,
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ],
            variants: [
              {
                id: "variant_1",
                title: "Default",
                sku: "COF-1",
                inventory_items: [{ inventory_item_id: "iitem_1" }],
                prices: [{ amount: 350, currency_code: "etb" }],
              },
            ],
            status: "published",
            thumbnail: "https://cdn.test/coffee.jpg",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.getMerchantProduct({
      productId: "prod_1",
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.headers.get("authorization"), "Basic medusa_token");
    assert.equal(
      forwardedRequest.url,
      "http://medusa:9000/admin/products/prod_1?fields=id%2Ctitle%2Cdescription%2Chandle%2Cstatus%2Cthumbnail%2Ccollection_id%2Ccategories.id%2Cimages.id%2Cimages.url%2Cimages.rank%2Cimages.created_at%2Cimages.updated_at%2Cvariants.id%2Cvariants.title%2Cvariants.sku%2Cvariants.prices.amount%2Cvariants.prices.currency_code%2Cvariants.inventory_items.inventory_item_id%2Ccreated_at%2Cupdated_at%2Csales_channels.id",
    );
    assert.deepEqual(result, {
      ok: true,
      product: {
        id: "prod_1",
        categoryIds: ["pcat_1"],
        collectionId: "pcol_1",
        description: "Roasted coffee beans",
        title: "Coffee",
        handle: "coffee",
        status: "published",
        thumbnail: "https://cdn.test/coffee.jpg",
        images: [
          {
            id: "img_1",
            url: "https://cdn.test/coffee-1.jpg",
            rank: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        variants: [
          {
            id: "variant_1",
            inventoryItemId: "iitem_1",
            title: "Default",
            sku: "COF-1",
            prices: [
              {
                amount: 350,
                currencyCode: "etb",
              },
            ],
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("does not get products outside the resolved tenant sales channel", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () =>
        Response.json({
          product: {
            id: "prod_1",
            sales_channels: [{ id: "sc_other" }],
          },
        }),
    });

    const result = await service.getMerchantProduct({
      productId: "prod_1",
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "product_not_found",
      status: 404,
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
              description: "Roasted coffee beans",
              handle: "coffee",
              collection_id: "pcol_1",
              categories: [{ id: "pcat_1" }],
              variants: [
                {
                  id: "variant_1",
                  title: "Default",
                  sku: "COFFEE-1",
                  prices: [{ amount: 350, currency_code: "etb" }],
                },
              ],
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
    assert.equal(forwardedRequest.headers.get("authorization"), "Basic medusa_token");

    const url = new URL(forwardedRequest.url);
    assert.equal(url.origin + url.pathname, "http://medusa:9000/admin/products");
    assert.equal(url.searchParams.get("limit"), "5");
    assert.equal(url.searchParams.get("offset"), "10");
    assert.equal(url.searchParams.get("order"), "-created_at");
    assert.equal(url.searchParams.get("sales_channel_id[]"), "sc_1");
    assert.equal(
      url.searchParams.get("fields"),
      "id,title,description,handle,status,thumbnail,collection_id,categories.id,images.id,images.url,images.rank,images.created_at,images.updated_at,variants.id,variants.title,variants.sku,variants.prices.amount,variants.prices.currency_code,created_at,updated_at,sales_channels.id",
    );
    assert.deepEqual(result, {
      ok: true,
      products: [
        {
          id: "prod_1",
          categoryIds: ["pcat_1"],
          collectionId: "pcol_1",
          description: "Roasted coffee beans",
          title: "Coffee",
          handle: "coffee",
          status: "published",
          thumbnail: null,
          variants: [
            {
              id: "variant_1",
              inventoryItemId: null,
              title: "Default",
              sku: "COFFEE-1",
              prices: [
                {
                  amount: 350,
                  currencyCode: "etb",
                },
              ],
            },
          ],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 1,
      limit: 5,
      offset: 10,
    });
  });

  it("maps missing Medusa product list resources to a commerce resource setup error", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => Response.json({ message: "Sales channel not found" }, { status: 404 }),
    });

    const result = await service.listMerchantProducts({
      limit: 20,
      offset: 0,
      salesChannelId: "sc_missing",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "commerce_resource_missing",
      status: 503,
    });
  });

  it("keeps unknown Medusa product list 404s as backend unavailable", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => Response.json({ message: "Route not found" }, { status: 404 }),
    });

    const result = await service.listMerchantProducts({
      limit: 20,
      offset: 0,
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    });
  });

  it("gets product stock through the default variant inventory item", async () => {
    const forwardedRequests: Request[] = [];
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        if (request.url.includes("/admin/products/prod_1")) {
          return Response.json({
            product: {
              id: "prod_1",
              sales_channels: [{ id: "sc_1" }],
              variants: [
                {
                  id: "variant_1",
                  inventory_items: [{ inventory_item_id: "iitem_1" }],
                },
              ],
            },
          });
        }

        return Response.json({
          inventory_item: {
            id: "iitem_1",
            location_levels: [
              {
                location_id: "sloc_1",
                stocked_quantity: 12,
                reserved_quantity: 2,
                incoming_quantity: 0,
                available_quantity: 10,
              },
            ],
          },
        });
      },
    });

    const result = await service.getMerchantProductStock({
      productId: "prod_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequests.length, 2);
    assert.equal(
      forwardedRequests[0]?.url,
      "http://medusa:9000/admin/products/prod_1?fields=id%2Csales_channels.id%2Cvariants.id%2Cvariants.inventory_items.inventory_item_id",
    );
    assert.equal(
      forwardedRequests[1]?.url,
      "http://medusa:9000/admin/inventory-items/iitem_1?fields=id%2C*location_levels",
    );
    assert.deepEqual(result, {
      ok: true,
      stock: {
        productId: "prod_1",
        variantId: "variant_1",
        inventoryItemId: "iitem_1",
        locationId: "sloc_1",
        stockedQuantity: 12,
        reservedQuantity: 2,
        incomingQuantity: 0,
        availableQuantity: 10,
      },
    });
  });

  it("updates product stock through the default variant inventory item", async () => {
    const forwardedRequests: Request[] = [];
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        if (request.url.includes("/admin/products/prod_1")) {
          return Response.json({
            product: {
              id: "prod_1",
              sales_channels: [{ id: "sc_1" }],
              variants: [
                {
                  id: "variant_1",
                  inventory_items: [{ inventory_item_id: "iitem_1" }],
                },
              ],
            },
          });
        }

        return Response.json({
          inventory_item: {
            id: "iitem_1",
            location_levels: [
              {
                location_id: "sloc_1",
                stocked_quantity: 15,
                reserved_quantity: 0,
                incoming_quantity: 0,
                available_quantity: 15,
              },
            ],
          },
        });
      },
    });

    const result = await service.updateMerchantProductStock({
      productId: "prod_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
      stockedQuantity: 15,
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequests.length, 2);
    assert.equal(forwardedRequests[1]?.method, "POST");
    assert.equal(
      forwardedRequests[1]?.url,
      "http://medusa:9000/admin/inventory-items/iitem_1/location-levels/sloc_1",
    );
    assert.deepEqual(await forwardedRequests[1]?.json(), {
      stocked_quantity: 15,
    });
    assert.deepEqual(result, {
      ok: true,
      stock: {
        productId: "prod_1",
        variantId: "variant_1",
        inventoryItemId: "iitem_1",
        locationId: "sloc_1",
        stockedQuantity: 15,
        reservedQuantity: 0,
        incomingQuantity: 0,
        availableQuantity: 15,
      },
    });
  });

  it("does not return product stock outside the resolved tenant sales channel", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () =>
        Response.json({
          product: {
            id: "prod_1",
            sales_channels: [{ id: "sc_other" }],
            variants: [
              {
                id: "variant_1",
                inventory_items: [{ inventory_item_id: "iitem_1" }],
              },
            ],
          },
        }),
    });

    const result = await service.getMerchantProductStock({
      productId: "prod_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "product_not_found",
      status: 404,
    });
  });

  it("does not read stock for multi-variant products", async () => {
    let calls = 0;
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => {
        calls += 1;

        return Response.json({
          product: {
            id: "prod_1",
            sales_channels: [{ id: "sc_1" }],
            variants: [
              {
                id: "variant_1",
                inventory_items: [{ inventory_item_id: "iitem_1" }],
              },
              {
                id: "variant_2",
                inventory_items: [{ inventory_item_id: "iitem_2" }],
              },
            ],
          },
        });
      },
    });

    const result = await service.getMerchantProductStock({
      productId: "prod_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
    });

    assert.equal(calls, 1);
    assert.deepEqual(result, {
      ok: false,
      error: "product_variant_unsupported",
      status: 409,
    });
  });

  it("does not update stock for multi-variant products", async () => {
    let calls = 0;
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => {
        calls += 1;

        return Response.json({
          product: {
            id: "prod_1",
            sales_channels: [{ id: "sc_1" }],
            variants: [
              {
                id: "variant_1",
                inventory_items: [{ inventory_item_id: "iitem_1" }],
              },
              {
                id: "variant_2",
                inventory_items: [{ inventory_item_id: "iitem_2" }],
              },
            ],
          },
        });
      },
    });

    const result = await service.updateMerchantProductStock({
      productId: "prod_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
      stockedQuantity: 15,
    });

    assert.equal(calls, 1);
    assert.deepEqual(result, {
      ok: false,
      error: "product_variant_unsupported",
      status: 409,
    });
  });

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
            {
              id: "pcat_2",
              name: "Other",
              metadata: {
                platform_tenant_id: "tenant_2",
              },
            },
          ],
          count: 2,
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
      "http://medusa:9000/admin/product-categories?limit=5&offset=10&order=-created_at&fields=id%2Cname%2Chandle%2Cis_active%2Cis_internal%2Cparent_category_id%2Cmetadata%2Ccreated_at%2Cupdated_at",
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
      ],
      count: 1,
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
            {
              id: "pcol_2",
              title: "Other",
              metadata: {
                platform_tenant_id: "tenant_2",
              },
            },
          ],
          count: 2,
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
      "http://medusa:9000/admin/collections?limit=5&offset=10&order=-created_at&fields=id%2Ctitle%2Chandle%2Cmetadata%2Ccreated_at%2Cupdated_at",
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
