import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMedusaProductService } from "./service.js";
import { getProductsUrl, PRODUCT_LIST_FIELDS } from "./urls.js";

describe("createMedusaProductService: product inventory", () => {
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

  it("gets stock for a specific multi-variant product variant", async () => {
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
                {
                  id: "variant_2",
                  inventory_items: [{ inventory_item_id: "iitem_2" }],
                },
              ],
            },
          });
        }

        return Response.json({
          inventory_item: {
            id: "iitem_2",
            location_levels: [
              {
                location_id: "sloc_1",
                stocked_quantity: 22,
                reserved_quantity: 3,
                incoming_quantity: 1,
                available_quantity: 19,
              },
            ],
          },
        });
      },
    });

    const result = await service.getMerchantProductVariantStock({
      productId: "prod_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
      variantId: "variant_2",
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequests.length, 2);
    assert.equal(
      forwardedRequests[0]?.url,
      "http://medusa:9000/admin/products/prod_1?fields=id%2Csales_channels.id%2Cvariants.id%2Cvariants.inventory_items.inventory_item_id",
    );
    assert.equal(
      forwardedRequests[1]?.url,
      "http://medusa:9000/admin/inventory-items/iitem_2?fields=id%2C*location_levels",
    );
    assert.deepEqual(result, {
      ok: true,
      stock: {
        productId: "prod_1",
        variantId: "variant_2",
        inventoryItemId: "iitem_2",
        locationId: "sloc_1",
        stockedQuantity: 22,
        reservedQuantity: 3,
        incomingQuantity: 1,
        availableQuantity: 19,
      },
    });
  });

  it("returns zero stock when a variant inventory item has no level at the stock location", async () => {
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input) => {
        const request = new Request(input);

        if (request.url.includes("/admin/products/prod_1")) {
          return Response.json({
            product: {
              id: "prod_1",
              sales_channels: [{ id: "sc_1" }],
              variants: [
                {
                  id: "variant_2",
                  inventory_items: [{ inventory_item_id: "iitem_2" }],
                },
              ],
            },
          });
        }

        return Response.json({
          inventory_item: {
            id: "iitem_2",
            location_levels: [],
          },
        });
      },
    });

    const result = await service.getMerchantProductVariantStock({
      productId: "prod_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
      variantId: "variant_2",
    });

    assert.deepEqual(result, {
      ok: true,
      stock: {
        productId: "prod_1",
        variantId: "variant_2",
        inventoryItemId: "iitem_2",
        locationId: "sloc_1",
        stockedQuantity: 0,
        reservedQuantity: 0,
        incomingQuantity: 0,
        availableQuantity: 0,
      },
    });
  });

  it("updates stock for a specific multi-variant product variant", async () => {
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
                {
                  id: "variant_2",
                  inventory_items: [{ inventory_item_id: "iitem_2" }],
                },
              ],
            },
          });
        }

        return Response.json({
          inventory_item: {
            id: "iitem_2",
            location_levels: [
              {
                location_id: "sloc_1",
                stocked_quantity: 18,
                reserved_quantity: 0,
                incoming_quantity: 0,
                available_quantity: 18,
              },
            ],
          },
        });
      },
    });

    const result = await service.updateMerchantProductVariantStock({
      productId: "prod_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
      stockedQuantity: 18,
      variantId: "variant_2",
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequests.length, 2);
    assert.equal(forwardedRequests[1]?.method, "POST");
    assert.equal(
      forwardedRequests[1]?.url,
      "http://medusa:9000/admin/inventory-items/iitem_2/location-levels/sloc_1",
    );
    assert.deepEqual(await forwardedRequests[1]?.json(), {
      stocked_quantity: 18,
    });
    assert.deepEqual(result, {
      ok: true,
      stock: {
        productId: "prod_1",
        variantId: "variant_2",
        inventoryItemId: "iitem_2",
        locationId: "sloc_1",
        stockedQuantity: 18,
        reservedQuantity: 0,
        incomingQuantity: 0,
        availableQuantity: 18,
      },
    });
  });

  it("creates a variant inventory location level when updating missing stock", async () => {
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
                  id: "variant_2",
                  inventory_items: [{ inventory_item_id: "iitem_2" }],
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
            id: "iitem_2",
            location_levels: [
              {
                location_id: "sloc_1",
                stocked_quantity: 18,
                reserved_quantity: 0,
                incoming_quantity: 0,
                available_quantity: 18,
              },
            ],
          },
        });
      },
    });

    const result = await service.updateMerchantProductVariantStock({
      productId: "prod_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
      stockedQuantity: 18,
      variantId: "variant_2",
    });

    assert.equal(result.ok, true);
    assert.deepEqual(
      forwardedRequests.map((request) => `${request.method} ${request.url}`),
      [
        "GET http://medusa:9000/admin/products/prod_1?fields=id%2Csales_channels.id%2Cvariants.id%2Cvariants.inventory_items.inventory_item_id",
        "POST http://medusa:9000/admin/inventory-items/iitem_2/location-levels/sloc_1",
        "POST http://medusa:9000/admin/inventory-items/iitem_2/location-levels",
      ],
    );
    assert.deepEqual(await forwardedRequests[2]?.json(), {
      location_id: "sloc_1",
      stocked_quantity: 18,
    });
  });
});
