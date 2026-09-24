import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution } from "../support/platform-app-harness.js";

describe("operator tenant catalog", () => {
  it("lists tenant product categories scoped to the selected tenant", async () => {
    let categoriesInput:
      | {
          limit: number;
          offset: number;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async () => ({
          ok: true,
          context: {
            tenantId: "tenant_1",
            medusaStoreId: "store_1",
            medusaSalesChannelId: "channel_1",
            medusaPublishableKeyId: "pk_1",
            medusaRegionId: "reg_1",
          },
        }),
        listMerchantProductCategories: async (input) => {
          categoriesInput = input;

          return {
            ok: true,
            count: 1,
            limit: input.limit,
            offset: input.offset,
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
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/product-categories?limit=5");

    assert.equal(response.status, 200);
    assert.deepEqual(categoriesInput, {
      limit: 5,
      offset: 0,
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
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
      offset: 0,
    });
  });

  it("creates tenant product categories scoped to the selected tenant", async () => {
    let categoryInput:
      | {
          handle?: string | null | undefined;
          name: string;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async () => ({
          ok: true,
          context: {
            tenantId: "tenant_1",
            medusaStoreId: "store_1",
            medusaSalesChannelId: "channel_1",
            medusaPublishableKeyId: "pk_1",
            medusaRegionId: "reg_1",
          },
        }),
        createMerchantProductCategory: async (input) => {
          categoryInput = input;

          return {
            ok: true,
            category: {
              id: "pcat_1",
              name: input.name,
              handle: input.handle ?? null,
              isActive: true,
              isInternal: false,
              parentCategoryId: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/product-categories", {
      body: JSON.stringify({
        name: "Coffee",
        handle: "coffee",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(categoryInput, {
      name: "Coffee",
      handle: "coffee",
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
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

  it("lists tenant product collections scoped to the selected tenant", async () => {
    let collectionsInput:
      | {
          limit: number;
          offset: number;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async () => ({
          ok: true,
          context: {
            tenantId: "tenant_1",
            medusaStoreId: "store_1",
            medusaSalesChannelId: "channel_1",
            medusaPublishableKeyId: "pk_1",
            medusaRegionId: "reg_1",
          },
        }),
        listMerchantProductCollections: async (input) => {
          collectionsInput = input;

          return {
            ok: true,
            count: 1,
            limit: input.limit,
            offset: input.offset,
            collections: [
              {
                id: "pcol_1",
                title: "Featured",
                handle: "featured",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/product-collections?limit=5");

    assert.equal(response.status, 200);
    assert.deepEqual(collectionsInput, {
      limit: 5,
      offset: 0,
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
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
      offset: 0,
    });
  });

  it("creates tenant product collections scoped to the selected tenant", async () => {
    let collectionInput:
      | {
          handle?: string | null | undefined;
          tenantId: string;
          title: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async () => ({
          ok: true,
          context: {
            tenantId: "tenant_1",
            medusaStoreId: "store_1",
            medusaSalesChannelId: "channel_1",
            medusaPublishableKeyId: "pk_1",
            medusaRegionId: "reg_1",
          },
        }),
        createMerchantProductCollection: async (input) => {
          collectionInput = input;

          return {
            ok: true,
            collection: {
              id: "pcol_1",
              title: input.title,
              handle: input.handle ?? null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/product-collections", {
      body: JSON.stringify({
        title: "Featured",
        handle: "featured",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(collectionInput, {
      title: "Featured",
      handle: "featured",
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      collection: {
        id: "pcol_1",
        title: "Featured",
        handle: "featured",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("lists tenant products scoped to the selected tenant sales channel", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let productsInput:
      | {
          limit: number;
          offset: number;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        listMerchantProducts: async (input) => {
          productsInput = input;

          return {
            ok: true,
            count: 1,
            limit: input.limit,
            offset: input.offset,
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
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/products?limit=5&offset=10");

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(productsInput, {
      limit: 5,
      offset: 10,
      salesChannelId: "channel_1",
      stockLocationId: undefined,
    });
    assert.deepEqual(await response.json(), {
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

  it("returns tenant product details scoped to the selected tenant sales channel", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let productInput:
      | {
          productId: string;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        getMerchantProduct: async (input) => {
          productInput = input;

          return {
            ok: true,
            product: {
              id: input.productId,
              categoryIds: ["pcat_1"],
              collectionId: "pcol_1",
              description: "Roasted coffee beans",
              title: "Coffee",
              handle: "coffee",
              status: "published",
              thumbnail: null,
              variants: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/products/prod_1");

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(productInput, {
      productId: "prod_1",
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      product: {
        id: "prod_1",
        categoryIds: ["pcat_1"],
        collectionId: "pcol_1",
        description: "Roasted coffee beans",
        title: "Coffee",
        handle: "coffee",
        status: "published",
        thumbnail: null,
        variants: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("returns tenant product stock scoped to the selected tenant stock location", async () => {
    let stockInput:
      | {
          productId: string;
          salesChannelId: string;
          stockLocationId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async () => ({
          ok: true,
          context: {
            tenantId: "tenant_1",
            medusaStoreId: "store_1",
            medusaSalesChannelId: "channel_1",
            medusaStockLocationId: "sloc_1",
            medusaPublishableKeyId: "pk_1",
            medusaRegionId: "reg_1",
          },
        }),
        getMerchantProductStock: async (input) => {
          stockInput = input;

          return {
            ok: true,
            stock: {
              productId: input.productId,
              variantId: "variant_1",
              inventoryItemId: "iitem_1",
              locationId: input.stockLocationId,
              stockedQuantity: 12,
              reservedQuantity: 2,
              incomingQuantity: 0,
              availableQuantity: 10,
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/products/prod_1/stock");

    assert.equal(response.status, 200);
    assert.deepEqual(stockInput, {
      productId: "prod_1",
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
    });
    assert.deepEqual(await response.json(), {
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

  it("updates tenant product stock scoped to the selected tenant stock location", async () => {
    let stockInput:
      | {
          productId: string;
          salesChannelId: string;
          stockLocationId: string;
          stockedQuantity: number;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async () => ({
          ok: true,
          context: {
            tenantId: "tenant_1",
            medusaStoreId: "store_1",
            medusaSalesChannelId: "channel_1",
            medusaStockLocationId: "sloc_1",
            medusaPublishableKeyId: "pk_1",
            medusaRegionId: "reg_1",
          },
        }),
        updateMerchantProductStock: async (input) => {
          stockInput = input;

          return {
            ok: true,
            stock: {
              productId: input.productId,
              variantId: "variant_1",
              inventoryItemId: "iitem_1",
              locationId: input.stockLocationId,
              stockedQuantity: input.stockedQuantity,
              reservedQuantity: 0,
              incomingQuantity: 0,
              availableQuantity: input.stockedQuantity,
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/products/prod_1/stock", {
      body: JSON.stringify({
        stockedQuantity: 15,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(stockInput, {
      productId: "prod_1",
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
      stockedQuantity: 15,
    });
    assert.deepEqual(await response.json(), {
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

  it("gets tenant product variant stock scoped to the selected tenant", async () => {
    let stockInput:
      | {
          productId: string;
          salesChannelId: string;
          stockLocationId: string;
          variantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe Owner" },
        }),
        getTenantCommerceContext: async () => ({
          ok: true,
          context: {
            tenantId: "tenant_1",
            medusaStoreId: "store_1",
            medusaSalesChannelId: "channel_1",
            medusaStockLocationId: "sloc_1",
            medusaPublishableKeyId: "pk_1",
            medusaRegionId: "reg_1",
          },
        }),
        getMerchantProductVariantStock: async (input) => {
          stockInput = input;
          return {
            ok: true,
            stock: {
              productId: input.productId,
              variantId: input.variantId,
              inventoryItemId: "iitem_1",
              locationId: input.stockLocationId,
              stockedQuantity: 12,
              reservedQuantity: 2,
              incomingQuantity: 0,
              availableQuantity: 10,
            },
          };
        },
      },
    );

    const response = await app.request(
      "/platform/tenants/tenant_1/products/prod_1/variants/variant_1/stock",
    );

    assert.equal(response.status, 200);
    assert.deepEqual(stockInput, {
      productId: "prod_1",
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
      variantId: "variant_1",
    });
  });

  it("updates tenant product variant stock scoped to the selected tenant", async () => {
    let stockInput:
      | {
          productId: string;
          salesChannelId: string;
          stockLocationId: string;
          stockedQuantity: number;
          variantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe Owner" },
        }),
        getTenantCommerceContext: async () => ({
          ok: true,
          context: {
            tenantId: "tenant_1",
            medusaStoreId: "store_1",
            medusaSalesChannelId: "channel_1",
            medusaStockLocationId: "sloc_1",
            medusaPublishableKeyId: "pk_1",
            medusaRegionId: "reg_1",
          },
        }),
        updateMerchantProductVariantStock: async (input) => {
          stockInput = input;
          return {
            ok: true,
            stock: {
              productId: input.productId,
              variantId: input.variantId,
              inventoryItemId: "iitem_1",
              locationId: input.stockLocationId,
              stockedQuantity: input.stockedQuantity,
              reservedQuantity: 0,
              incomingQuantity: 0,
              availableQuantity: input.stockedQuantity,
            },
          };
        },
      },
    );

    const response = await app.request(
      "/platform/tenants/tenant_1/products/prod_1/variants/variant_1/stock",
      {
        body: JSON.stringify({ stockedQuantity: 18 }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(stockInput, {
      productId: "prod_1",
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
      stockedQuantity: 18,
      variantId: "variant_1",
    });
  });
});
