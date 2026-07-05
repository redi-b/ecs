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
                options: [
                  {
                    value: "Default",
                    option: { title: "Default" },
                  },
                ],
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
            optionValues: [{ optionTitle: "Default", value: "Default" }],
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

  it("creates variants from merchant product options", async () => {
    let forwardedRequest: Request | undefined;
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          product: {
            id: "prod_1",
            title: "T-shirt",
            handle: "t-shirt",
            variants: [
              {
                id: "variant_s",
                title: "Small",
                prices: [{ amount: 400, currency_code: "etb" }],
              },
              {
                id: "variant_m",
                title: "Medium",
                prices: [{ amount: 400, currency_code: "etb" }],
              },
            ],
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.createMerchantProduct({
      title: "T-shirt",
      handle: "t-shirt",
      options: [{ title: "Size", values: ["Small", "Medium", "Small"] }],
      priceAmount: 400,
      currencyCode: "ETB",
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);
    assert.deepEqual(await forwardedRequest.json(), {
      title: "T-shirt",
      handle: "t-shirt",
      options: [
        {
          title: "Size",
          values: ["Small", "Medium"],
        },
      ],
      variants: [
        {
          title: "Small",
          options: {
            Size: "Small",
          },
          prices: [{ amount: 400, currency_code: "etb" }],
        },
        {
          title: "Medium",
          options: {
            Size: "Medium",
          },
          prices: [{ amount: 400, currency_code: "etb" }],
        },
      ],
      sales_channels: [{ id: "sc_1" }],
    });
  });

  it("maps Medusa product write conflicts to product conflict errors", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => Response.json({ message: "Handle already exists" }, { status: 409 }),
    });

    const result = await service.createMerchantProduct({
      title: "Coffee",
      handle: "coffee",
      priceAmount: 350,
      currencyCode: "ETB",
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "product_conflict",
      status: 409,
    });
  });

  it("maps Medusa product validation failures to product write errors", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => Response.json({ message: "Invalid product" }, { status: 400 }),
    });

    const result = await service.createMerchantProduct({
      title: "Coffee",
      handle: "coffee",
      priceAmount: 350,
      currencyCode: "ETB",
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "product_write_invalid",
      status: 400,
    });
  });

  it("keeps product creation successful when initial stock level setup fails", async () => {
    const forwardedRequests: Request[] = [];
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        if (request.method === "POST" && request.url === "http://medusa:9000/admin/products") {
          return Response.json({
            product: {
              id: "prod_1",
              title: "Coffee",
              handle: "coffee",
              status: "draft",
              variants: [
                {
                  id: "variant_1",
                  title: "Default",
                  prices: [{ amount: 350, currency_code: "etb" }],
                  inventory_items: [{ inventory_item_id: "iitem_1" }],
                },
              ],
              sales_channels: [{ id: "sc_1" }],
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
            },
          });
        }

        if (request.method === "GET") {
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

        return Response.json({ message: "stock level failed" }, { status: 500 });
      },
    });

    const result = await service.createMerchantProduct({
      title: "Coffee",
      handle: "coffee",
      priceAmount: 350,
      currencyCode: "ETB",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.product.id : "", "prod_1");
    assert.deepEqual(
      forwardedRequests.map((request) => `${request.method} ${request.url}`),
      [
        "POST http://medusa:9000/admin/products",
        "GET http://medusa:9000/admin/products/prod_1?fields=id%2Csales_channels.id%2Cvariants.id%2Cvariants.inventory_items.inventory_item_id",
        "POST http://medusa:9000/admin/inventory-items/iitem_1/location-levels",
      ],
    );
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
      "http://medusa:9000/admin/products/prod_1?fields=id%2Ctitle%2Cdescription%2Chandle%2Cstatus%2Cthumbnail%2Ccollection_id%2Ccategories.id%2Cimages.id%2Cimages.url%2Cimages.rank%2Cimages.created_at%2Cimages.updated_at%2Cvariants.id%2Cvariants.title%2Cvariants.sku%2Cvariants.options.value%2Cvariants.options.option.title%2Cvariants.prices.amount%2Cvariants.prices.currency_code%2Cvariants.inventory_items.inventory_item_id%2Ccreated_at%2Cupdated_at%2Csales_channels.id",
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

  it("gets a product when ownership is verified by a scoped product list fallback", async () => {
    const forwardedRequests: Request[] = [];
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        if (request.url.includes("/admin/products?")) {
          return Response.json({
            products: [{ id: "prod_1" }],
          });
        }

        return Response.json({
          product: {
            id: "prod_1",
            title: "Coffee",
            handle: "coffee",
            status: "published",
            thumbnail: null,
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
    assert.equal(forwardedRequests.length, 2);
    assert.equal(
      forwardedRequests[1]?.url,
      "http://medusa:9000/admin/products?limit=1&offset=0&fields=id&id%5B%5D=prod_1&sales_channel_id%5B%5D=sc_1",
    );
  });

  it("falls back to scoped ownership when the detail response has no usable sales channel ids", async () => {
    const forwardedRequests: Request[] = [];
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        if (request.url.includes("/admin/products?")) {
          return Response.json({
            products: [{ id: "prod_1" }],
          });
        }

        return Response.json({
          product: {
            id: "prod_1",
            title: "Coffee",
            handle: "coffee",
            sales_channels: [{}],
            status: "published",
            thumbnail: null,
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
    assert.equal(forwardedRequests.length, 2);
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

  it("updates a product when ownership is verified by a scoped product list fallback", async () => {
    const forwardedRequests: Request[] = [];
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        if (request.method === "POST") {
          return Response.json({
            product: {
              id: "prod_1",
              title: "Updated coffee",
              handle: "updated-coffee",
              status: "draft",
              thumbnail: null,
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
            },
          });
        }

        if (request.url.includes("/admin/products?")) {
          return Response.json({
            products: [{ id: "prod_1" }],
          });
        }

        return Response.json({
          product: {
            id: "prod_1",
            sales_channels: [{}],
          },
        });
      },
    });

    const result = await service.updateMerchantProduct({
      productId: "prod_1",
      title: "Updated coffee",
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequests.length, 3);
    assert.equal(forwardedRequests[2]?.method, "POST");
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
      "id,title,description,handle,status,thumbnail,collection_id,categories.id,images.id,images.url,images.rank,images.created_at,images.updated_at,variants.id,variants.title,variants.sku,variants.options.value,variants.options.option.title,variants.prices.amount,variants.prices.currency_code,created_at,updated_at,sales_channels.id",
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

  it("keeps generic Medusa resource 404s as backend unavailable", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => Response.json({ message: "Resource not found" }, { status: 404 }),
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
        "http://medusa:9000/admin/products/prod_1?fields=id%2Csales_channels.id"
      );
      assert.equal(forwardedRequests[0]?.method, "GET");
      assert.equal(forwardedRequests[0]?.headers.get("authorization"), "Basic medusa_token");

      assert.equal(
        forwardedRequests[1]?.url,
        "http://medusa:9000/admin/products/prod_1"
      );
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
              products: [
                { id: "prod_1" },
                { id: "prod_2" },
              ],
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
        "http://medusa:9000/admin/product-categories/pcat_1?fields=id%2Cmetadata"
      );
      assert.equal(
        forwardedRequests[1]?.url,
        "http://medusa:9000/admin/product-categories/pcat_1"
      );
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
        "http://medusa:9000/admin/collections/pcol_1?fields=id%2Cmetadata"
      );
      assert.equal(
        forwardedRequests[1]?.url,
        "http://medusa:9000/admin/collections/pcol_1"
      );
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
  });
});

