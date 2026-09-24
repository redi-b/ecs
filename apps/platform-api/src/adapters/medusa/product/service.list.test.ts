import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMedusaProductService } from "./service.js";
import { getProductsUrl, PRODUCT_LIST_FIELDS } from "./urls.js";

describe("createMedusaProductService: product listing and search", () => {
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
    assert.equal(url.searchParams.get("fields"), PRODUCT_LIST_FIELDS);
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

  it("uses indexed ranking for dashboard product searches and hydrates from Medusa", async () => {
    const paths: string[] = [];
    const product = (id: string, title: string) => ({
      id,
      title,
      handle: title.toLowerCase(),
      status: "published",
      collection_id: null,
      categories: [],
      variants: [],
      thumbnail: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    });
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input) => {
        const url = new URL(String(input));
        paths.push(`${url.pathname}${url.search}`);
        if (url.pathname === "/admin/product-search") {
          return Response.json({ hits: [{ id: "p2" }, { id: "p1" }], count: 2 });
        }
        return Response.json({ products: [product("p1", "First"), product("p2", "Second")] });
      },
    });

    const result = await service.listMerchantProducts({
      categoryId: "pcat_1",
      collectionId: "pcol_1",
      limit: 6,
      offset: 0,
      q: "secon",
      salesChannelId: "sc_1",
      status: "published",
    });

    assert.ok(paths[0]?.startsWith("/admin/product-search?"));
    assert.ok(paths[0]?.includes("sales_channel_id=sc_1"));
    assert.ok(paths[0]?.includes("category_id=pcat_1"));
    assert.ok(paths[0]?.includes("collection_id=pcol_1"));
    assert.ok(paths[0]?.includes("status=published"));
    assert.ok(paths[1]?.startsWith("/admin/products?"));
    assert.deepEqual(result.ok ? result.products.map(({ id }) => id) : [], ["p2", "p1"]);
  });

  it("falls back to database product search when the index is unavailable", async () => {
    const paths: string[] = [];
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input) => {
        const url = new URL(String(input));
        paths.push(`${url.pathname}${url.search}`);
        if (url.pathname === "/admin/product-search") {
          return Response.json({ message: "unavailable" }, { status: 503 });
        }
        return Response.json({ products: [], count: 0, limit: 6, offset: 0 });
      },
    });

    const result = await service.listMerchantProducts({
      limit: 6,
      offset: 0,
      q: "cofee",
      salesChannelId: "sc_1",
    });

    assert.ok(paths[1]?.startsWith("/admin/products?"));
    assert.ok(paths[1]?.includes("q=cofee"));
    assert.equal(result.ok, true);
  });

  it("falls back to database product search when the entire index is empty", async () => {
    const paths: string[] = [];
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input) => {
        const url = new URL(String(input));
        paths.push(`${url.pathname}${url.search}`);
        if (url.pathname === "/admin/product-search") {
          return Response.json({ hits: [], count: 0, index_document_count: 0 });
        }
        return Response.json({
          products: [{ id: "p1", title: "Coffee", handle: "coffee", variants: [] }],
          count: 1,
          limit: 6,
          offset: 0,
        });
      },
    });

    const result = await service.listMerchantProducts({
      limit: 6,
      offset: 0,
      q: "coffee",
      salesChannelId: "sc_1",
    });

    assert.equal(paths.length, 2);
    assert.ok(paths[1]?.startsWith("/admin/products?"));
    assert.equal(result.ok && result.products[0]?.id, "p1");
  });

  it("paginates missing-category results directly in Medusa", async () => {
    const offsets: number[] = [];
    const source = Array.from({ length: 150 }, (_, index) => ({
      id: `prod_${index}`,
      title: `Product ${index}`,
      handle: `product-${index}`,
      status: index === 149 ? "archived" : "published",
      collection_id: null,
      categories: [],
      variants: [],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    }));
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/admin/platform-products");
        assert.equal(url.searchParams.get("category_missing"), "true");
        const offset = Number(url.searchParams.get("offset"));
        const limit = Number(url.searchParams.get("limit"));
        offsets.push(offset);
        return Response.json({
          products: source.slice(offset, offset + limit),
          count: source.length,
          limit,
          offset,
        });
      },
    });

    const result = await service.listMerchantProducts({
      categoryId: "none",
      limit: 10,
      offset: 120,
      salesChannelId: "sc_1",
    });

    assert.deepEqual(offsets, [120]);
    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.count : null, 150);
    assert.deepEqual(
      result.ok ? result.products.map((product) => product.id) : [],
      Array.from({ length: 10 }, (_, index) => `prod_${120 + index}`),
    );
  });

  it("accepts large filtered totals without scanning the catalog", async () => {
    let calls = 0;
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => {
        calls += 1;
        return Response.json({ products: [], count: 10_001, limit: 100, offset: 0 });
      },
    });

    const result = await service.listMerchantProducts({
      limit: 20,
      offset: 0,
      salesChannelId: "sc_1",
      status: "unknown",
    });

    assert.deepEqual(result, {
      ok: true,
      products: [],
      count: 10_001,
      limit: 20,
      offset: 0,
    });
    assert.equal(calls, 1);
  });

  it("hydrates product list variants with stock at the merchant location", async () => {
    const forwardedRequests: Request[] = [];
    const service = createMedusaProductService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        if (request.url.includes("/admin/products?")) {
          return Response.json({
            products: [
              {
                id: "prod_1",
                title: "Coffee",
                handle: "coffee",
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
            ],
            count: 1,
            limit: 20,
            offset: 0,
          });
        }

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
      },
    });

    const result = await service.listMerchantProducts({
      limit: 20,
      offset: 0,
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
    });

    assert.equal(result.ok, true);
    assert.deepEqual(
      forwardedRequests.map((request) => `${request.method} ${request.url}`),
      [
        `GET ${getProductsUrl("http://medusa:9000", {
          limit: 20,
          offset: 0,
          salesChannelId: "sc_1",
        }).toString()}`,
        "GET http://medusa:9000/admin/inventory-items?fields=id%2C*location_levels&limit=1&id%5B%5D=iitem_1",
      ],
    );
    assert.deepEqual(result.ok ? result.products[0]?.variants?.[0]?.stock : null, {
      locationId: "sloc_1",
      stockedQuantity: 12,
      reservedQuantity: 2,
      incomingQuantity: 0,
      availableQuantity: 10,
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
});
