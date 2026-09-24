import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMedusaProductService } from "./service.js";
import { getProductsUrl, PRODUCT_LIST_FIELDS } from "./urls.js";

describe("createMedusaProductService: product writes and ownership", () => {
  it("does not label a product query failure as a commerce outage", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () =>
        Response.json(
          { message: "Trying to query by not existing property Product.sales_channel_id" },
          { status: 500 },
        ),
    });
    const result = await service.listMerchantProducts({
      salesChannelId: "sc_1",
      media: "without_media",
      limit: 20,
      offset: 0,
    });
    assert.deepEqual(result, { ok: false, error: "commerce_backend_error", status: 502 });
  });
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
      thumbnail: null,
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
          manage_inventory: true,
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
          manage_inventory: true,
          options: {
            Size: "Small",
          },
          prices: [{ amount: 400, currency_code: "etb" }],
        },
        {
          title: "Medium",
          manage_inventory: true,
          options: {
            Size: "Medium",
          },
          prices: [{ amount: 400, currency_code: "etb" }],
        },
      ],
      sales_channels: [{ id: "sc_1" }],
    });
  });

  it("creates variants from explicit merchant variant rows", async () => {
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
                id: "variant_s_black",
                title: "S / Black",
                sku: "TEE-S-BLACK",
                prices: [{ amount: 450, currency_code: "etb" }],
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
      options: [
        { title: "Size", values: ["S"] },
        { title: "Color", values: ["Black"] },
      ],
      variants: [
        {
          optionValues: { Size: "S", Color: "Black" },
          sku: "TEE-S-BLACK",
          priceAmount: 450,
          currencyCode: "ETB",
          stockedQuantity: 8,
        },
      ],
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
        { title: "Size", values: ["S"] },
        { title: "Color", values: ["Black"] },
      ],
      variants: [
        {
          title: "S / Black",
          sku: "TEE-S-BLACK",
          manage_inventory: true,
          options: {
            Size: "S",
            Color: "Black",
          },
          prices: [{ amount: 450, currency_code: "etb" }],
        },
      ],
      sales_channels: [{ id: "sc_1" }],
    });
  });

  it("maps Medusa product write conflicts to product conflict errors", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () =>
        Response.json({ message: "Product with handle: coffee, already exists." }, { status: 400 }),
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
                  options: [{ value: "Default", option: { title: "Default" } }],
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
        "GET http://medusa:9000/admin/products/prod_1?fields=id%2Csales_channels.id%2Cvariants.id%2Cvariants.options.value%2Cvariants.options.option.title%2Cvariants.inventory_items.inventory_item_id",
        "POST http://medusa:9000/admin/inventory-items/iitem_1/location-levels/sloc_1",
      ],
    );
  });

  it("initializes created variant stock from requested stocked quantities", async () => {
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
              title: "T-shirt",
              handle: "t-shirt",
              variants: [{ id: "variant_1", title: "Small", prices: [] }],
              sales_channels: [{ id: "sc_1" }],
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
                  options: [{ value: "Small", option: { title: "Size" } }],
                  inventory_items: [{ inventory_item_id: "iitem_1" }],
                },
              ],
            },
          });
        }

        if (request.url.endsWith("/location-levels/sloc_1")) {
          return Response.json({ message: "missing level" }, { status: 404 });
        }

        return Response.json({
          inventory_item: {
            id: "iitem_1",
            location_levels: [],
          },
        });
      },
    });

    const result = await service.createMerchantProduct({
      title: "T-shirt",
      handle: "t-shirt",
      options: [{ title: "Size", values: ["Small"] }],
      variants: [
        {
          optionValues: { Size: "Small" },
          priceAmount: 400,
          currencyCode: "ETB",
          stockedQuantity: 8,
        },
      ],
      priceAmount: 400,
      currencyCode: "ETB",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
    });

    assert.equal(result.ok, true);
    assert.deepEqual(
      forwardedRequests.map((request) => `${request.method} ${request.url}`),
      [
        "POST http://medusa:9000/admin/products",
        "GET http://medusa:9000/admin/products/prod_1?fields=id%2Csales_channels.id%2Cvariants.id%2Cvariants.options.value%2Cvariants.options.option.title%2Cvariants.inventory_items.inventory_item_id",
        "POST http://medusa:9000/admin/inventory-items/iitem_1/location-levels/sloc_1",
        "POST http://medusa:9000/admin/inventory-items/iitem_1/location-levels",
      ],
    );
    assert.deepEqual(await forwardedRequests[3]?.json(), {
      location_id: "sloc_1",
      stocked_quantity: 8,
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
    assert.equal(forwardedRequests[1]?.url, "http://medusa:9000/admin/platform-products/prod_1");
    assert.deepEqual(await forwardedRequests[1]?.json(), {
      update: {
        title: "Updated coffee",
        status: "published",
        thumbnail: "https://cdn.test/coffee.jpg",
      },
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

  it("updates product media_variants metadata while preserving existing metadata", async () => {
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
              metadata: { platform_tenant_id: "tenant_1", custom_tag: "organic" },
            },
          });
        }

        return Response.json({
          product: {
            id: "prod_1",
            title: "Coffee",
            handle: "coffee",
            metadata: {
              platform_tenant_id: "tenant_1",
              custom_tag: "organic",
              media_variants: {
                "https://media.ourdomain.com/hero.png": {
                  w200: "https://media.ourdomain.com/hero-200w.webp",
                },
              },
            },
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-03T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.updateProductMediaVariants({
      productId: "prod_1",
      mediaVariants: {
        "https://media.ourdomain.com/hero.png": {
          w200: "https://media.ourdomain.com/hero-200w.webp",
        },
      },
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequests.length, 2);
    assert.equal(forwardedRequests[0]?.method, "GET");
    assert.equal(forwardedRequests[0]?.url, "http://medusa:9000/admin/products/prod_1");
    assert.equal(forwardedRequests[1]?.method, "POST");
    assert.equal(forwardedRequests[1]?.url, "http://medusa:9000/admin/platform-products/prod_1");
    assert.deepEqual(await forwardedRequests[1]?.json(), {
      update: {
        metadata: {
          media_variants: {
            "https://media.ourdomain.com/hero.png": {
              w200: "https://media.ourdomain.com/hero-200w.webp",
            },
          },
        },
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
      "http://medusa:9000/admin/products/prod_1?fields=id%2Ctitle%2Cdescription%2Chandle%2Cmetadata%2Cstatus%2Cthumbnail%2Ccollection_id%2Ccategories.id%2Cimages.id%2Cimages.url%2Cimages.rank%2Cimages.created_at%2Cimages.updated_at%2Coptions.id%2Coptions.title%2Coptions.values.id%2Coptions.values.value%2Coptions.values.metadata%2Cvariants.id%2Cvariants.title%2Cvariants.sku%2Cvariants.metadata%2Cvariants.options.value%2Cvariants.options.option.title%2Cvariants.prices.amount%2Cvariants.prices.currency_code%2Cvariants.inventory_items.inventory_item_id%2Ccreated_at%2Cupdated_at%2Csales_channels.id",
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

  it("hydrates product detail variants with merchant-location stock", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);

        if (request.url.includes("/admin/inventory-items")) {
          return Response.json({
            inventory_items: [
              {
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
            ],
          });
        }

        return Response.json({
          product: {
            id: "prod_1",
            title: "Coffee",
            handle: "coffee",
            status: "draft",
            sales_channels: [{ id: "sc_1" }],
            variants: [
              {
                id: "variant_1",
                title: "Default",
                inventory_items: [{ inventory_item_id: "iitem_1" }],
                prices: [{ amount: 350, currency_code: "etb" }],
              },
            ],
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.getMerchantProduct({
      productId: "prod_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
    });

    assert.deepEqual(result.ok ? result.product.variants?.[0]?.stock : null, {
      locationId: "sloc_1",
      stockedQuantity: 12,
      reservedQuantity: 2,
      incomingQuantity: 0,
      availableQuantity: 10,
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

  it("preserves existing variant identities in product update payloads", async () => {
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
              handle: "coffee",
              status: "published",
              thumbnail: null,
              variants: [],
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
            },
          });
        }

        return Response.json({
          product: {
            id: "prod_1",
            sales_channels: [{ id: "sc_1" }],
          },
        });
      },
    });

    const result = await service.updateMerchantProduct({
      productId: "prod_1",
      salesChannelId: "sc_1",
      priceAmount: 250,
      metadata: {
        ecs_import_execution_id: "execution_1",
        ecs_import_product_key: "update:prod_1",
      },
      options: [{ title: "Size", values: ["250g"] }],
      variants: [
        {
          id: "variant_1",
          currencyCode: "etb",
          optionValues: { Size: "250g" },
          prices: [
            { amount: 250, currencyCode: "etb" },
            { amount: 2, currencyCode: "usd" },
          ],
          sku: "COFFEE-250",
        },
      ],
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequests.length, 2);
    assert.equal(forwardedRequests[1]?.url, "http://medusa:9000/admin/platform-products/prod_1");
    assert.deepEqual(await forwardedRequests[1]?.json(), {
      before_options: { add: [{ title: "Size", values: ["250g"] }] },
      update: {
        metadata: {
          ecs_import_execution_id: "execution_1",
          ecs_import_product_key: "update:prod_1",
        },
        variants: [
          {
            id: "variant_1",
            title: "250g",
            sku: "COFFEE-250",
            manage_inventory: true,
            options: { Size: "250g" },
            prices: [
              { amount: 250, currency_code: "etb" },
              { amount: 2, currency_code: "usd" },
            ],
          },
        ],
      },
    });
  });

  it("reconciles only an exact import-owned product identity", async () => {
    let forwardedRequest: Request | undefined;
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);
        return Response.json({
          products: [
            {
              id: "prod_imported",
              handle: "buna",
              metadata: {
                ecs_import_execution_id: "execution_1",
                ecs_import_product_key: "create:buna",
              },
              variants: [{ id: "variant_1", sku: "BUNA-1" }],
            },
          ],
        });
      },
    });

    const result = await service.findImportedProduct({
      executionId: "execution_1",
      handle: "buna",
      productKey: "create:buna",
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: true,
      product: {
        id: "prod_imported",
        variantIdsBySku: { "buna-1": "variant_1" },
      },
    });
    assert.ok(forwardedRequest);
    const url = new URL(forwardedRequest.url);
    assert.equal(url.searchParams.get("q"), "buna");
    assert.equal(url.searchParams.get("sales_channel_id[]"), "sc_1");
    assert.equal(url.searchParams.get("fields"), "id,handle,metadata,variants.id,variants.sku");
  });

  it("rejects an unrelated product that already owns an import handle", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () =>
        Response.json({
          products: [{ id: "prod_other", handle: "buna", metadata: {} }],
        }),
    });

    assert.deepEqual(
      await service.findImportedProduct({
        executionId: "execution_1",
        handle: "buna",
        productKey: "create:buna",
        salesChannelId: "sc_1",
      }),
      { ok: false, error: "product_conflict", status: 409 },
    );
  });
});
