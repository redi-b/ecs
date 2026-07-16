import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appWithResolution,
  type NotificationEventType,
  resolvedTenantContext,
} from "./test/platform-app-harness.js";

describe("platform app merchant and tenant catalog", () => {
  it("lists merchant products scoped to the resolved tenant sales channel", async () => {
    let productsInput:
      | {
          limit: number;
          offset: number;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
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

    const response = await app.request("/platform/merchant/products?limit=5&offset=10", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(productsInput, {
      limit: 5,
      offset: 10,
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
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

  it("returns merchant product details scoped to the resolved tenant sales channel", async () => {
    let productInput:
      | {
          productId: string;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
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
              variants: [
                {
                  id: "variant_1",
                  inventoryItemId: "iitem_1",
                  title: "Default",
                  sku: "COF-1",
                  prices: [{ amount: 350, currencyCode: "etb" }],
                },
              ],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products/prod_1", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
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
        variants: [
          {
            id: "variant_1",
            inventoryItemId: "iitem_1",
            title: "Default",
            sku: "COF-1",
            prices: [{ amount: 350, currencyCode: "etb" }],
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

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

  it("creates merchant product categories scoped to the resolved tenant", async () => {
    let resolvedHost: string | undefined;
    let sessionCookie: string | null = null;
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let categoryInput:
      | {
          handle?: string | null | undefined;
          name: string;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async (input) => {
          authorizationInput = input;

          return {
            ok: true,
            actor: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
              role: "owner",
            },
          };
        },
        getSession: async (headers) => {
          sessionCookie = headers.get("cookie");

          return {
            user: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
            },
          };
        },
        resolveTenantForHost: async (host) => {
          resolvedHost = host;

          return {
            ok: true,
            context: resolvedTenantContext,
          };
        },
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

    const response = await app.request("/platform/merchant/product-categories", {
      body: JSON.stringify({
        name: "Coffee",
        handle: "coffee",
      }),
      headers: {
        "content-type": "application/json",
        cookie: "better-auth.session_token=session_1",
        Host: "platform.lvh.me",
        "x-forwarded-host": "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.equal(resolvedHost, "abebe.lvh.me");
    assert.equal(sessionCookie, "better-auth.session_token=session_1");
    assert.deepEqual(authorizationInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
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

  it("rejects merchant product category creation without a name", async () => {
    let categoryCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        createMerchantProductCategory: async () => {
          categoryCalls += 1;

          return {
            ok: false,
            error: "commerce_backend_unavailable",
            status: 503,
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/product-categories", {
      body: JSON.stringify({
        handle: "coffee",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 400);
    assert.equal(categoryCalls, 0);
    assert.deepEqual(await response.json(), {
      error: "missing_name",
    });
  });

  it("creates merchant product collections scoped to the resolved tenant", async () => {
    let resolvedHost: string | undefined;
    let sessionCookie: string | null = null;
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let collectionInput:
      | {
          handle?: string | null | undefined;
          tenantId: string;
          title: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async (input) => {
          authorizationInput = input;

          return {
            ok: true,
            actor: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
              role: "owner",
            },
          };
        },
        getSession: async (headers) => {
          sessionCookie = headers.get("cookie");

          return {
            user: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
            },
          };
        },
        resolveTenantForHost: async (host) => {
          resolvedHost = host;

          return {
            ok: true,
            context: resolvedTenantContext,
          };
        },
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

    const response = await app.request("/platform/merchant/product-collections", {
      body: JSON.stringify({
        title: "Featured",
        handle: "featured",
      }),
      headers: {
        "content-type": "application/json",
        cookie: "better-auth.session_token=session_1",
        Host: "platform.lvh.me",
        "x-forwarded-host": "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.equal(resolvedHost, "abebe.lvh.me");
    assert.equal(sessionCookie, "better-auth.session_token=session_1");
    assert.deepEqual(authorizationInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
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

  it("rejects merchant product collection creation without a title", async () => {
    let collectionCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        createMerchantProductCollection: async () => {
          collectionCalls += 1;

          return {
            ok: false,
            error: "commerce_backend_unavailable",
            status: 503,
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/product-collections", {
      body: JSON.stringify({
        handle: "featured",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 400);
    assert.equal(collectionCalls, 0);
    assert.deepEqual(await response.json(), {
      error: "missing_title",
    });
  });

  it("returns merchant product stock scoped to the resolved tenant stock location", async () => {
    let stockInput:
      | {
          productId: string;
          salesChannelId: string;
          stockLocationId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
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

    const response = await app.request("/platform/merchant/products/prod_1/stock", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(stockInput, {
      productId: "prod_1",
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
    });
  });

  it("returns merchant product variant stock scoped to the resolved tenant stock location", async () => {
    let stockInput:
      | {
          productId: string;
          salesChannelId: string;
          stockLocationId: string;
          variantId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
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
      "/platform/merchant/products/prod_1/variants/variant_1/stock",
      {
        headers: {
          Host: "abebe.lvh.me",
        },
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(stockInput, {
      productId: "prod_1",
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
      variantId: "variant_1",
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

  it("updates merchant product variant stock scoped to the resolved tenant stock location", async () => {
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
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
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
      "/platform/merchant/products/prod_1/variants/variant_1/stock",
      {
        body: JSON.stringify({
          stockedQuantity: 24,
        }),
        headers: {
          "content-type": "application/json",
          Host: "abebe.lvh.me",
        },
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(stockInput, {
      productId: "prod_1",
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
      stockedQuantity: 24,
      variantId: "variant_1",
    });
    assert.deepEqual(await response.json(), {
      stock: {
        productId: "prod_1",
        variantId: "variant_1",
        inventoryItemId: "iitem_1",
        locationId: "sloc_1",
        stockedQuantity: 24,
        reservedQuantity: 0,
        incomingQuantity: 0,
        availableQuantity: 24,
      },
    });
  });

  it("creates merchant products scoped to the resolved tenant sales channel", async () => {
    let productInput:
      | {
          categoryIds?: string[] | undefined;
          collectionId?: string | null | undefined;
          currencyCode?: string | null | undefined;
          description?: string | null | undefined;
          handle?: string | null | undefined;
          imageUrls?: string[] | undefined;
          priceAmount?: number | undefined;
          regionId?: string | null | undefined;
          salesChannelId: string;
          status?: string | null | undefined;
          thumbnail?: string | null | undefined;
          title: string;
          variants?:
            | Array<{
                currencyCode: string;
                optionValues: Record<string, string>;
                priceAmount: number;
                sku?: string | null | undefined;
                stockedQuantity?: number | undefined;
              }>
            | undefined;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        createMerchantProduct: async (input) => {
          productInput = input;

          return {
            ok: true,
            product: {
              id: "prod_1",
              title: input.title,
              handle: input.handle ?? null,
              status: input.status ?? "draft",
              thumbnail: input.thumbnail ?? null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products", {
      body: JSON.stringify({
        title: "Coffee",
        description: "Roasted coffee beans",
        handle: "coffee",
        collectionId: "pcol_1",
        categoryIds: ["pcat_1"],
        imageUrls: ["https://cdn.test/coffee-1.jpg"],
        priceAmount: 350,
        currencyCode: "etb",
        variants: [
          {
            optionValues: { Size: "Small" },
            sku: "COFFEE-S",
            priceAmount: 350,
            currencyCode: "etb",
            stockedQuantity: 5,
          },
        ],
        status: "draft",
        thumbnail: "",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(productInput, {
      title: "Coffee",
      description: "Roasted coffee beans",
      handle: "coffee",
      collectionId: "pcol_1",
      categoryIds: ["pcat_1"],
      imageUrls: ["https://cdn.test/coffee-1.jpg"],
      priceAmount: 350,
      currencyCode: "etb",
      variants: [
        {
          optionValues: { Size: "Small" },
          sku: "COFFEE-S",
          priceAmount: 350,
          currencyCode: "etb",
          stockedQuantity: 5,
        },
      ],
      regionId: "reg_1",
      status: "draft",
      stockLocationId: "sloc_1",
      thumbnail: null,
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
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
  });

  it("creates tenant products scoped to the selected tenant sales channel", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let productInput:
      | {
          categoryIds?: string[] | undefined;
          collectionId?: string | null | undefined;
          currencyCode?: string | null | undefined;
          description?: string | null | undefined;
          handle?: string | null | undefined;
          imageUrls?: string[] | undefined;
          priceAmount?: number | undefined;
          regionId?: string | null | undefined;
          salesChannelId: string;
          status?: string | null | undefined;
          thumbnail?: string | null | undefined;
          title: string;
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
        createMerchantProduct: async (input) => {
          productInput = input;

          return {
            ok: true,
            product: {
              id: "prod_1",
              title: input.title,
              handle: input.handle ?? null,
              status: input.status ?? "draft",
              thumbnail: input.thumbnail ?? null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/products", {
      body: JSON.stringify({
        title: "Coffee",
        description: "Roasted coffee beans",
        handle: "coffee",
        collectionId: "pcol_1",
        categoryIds: ["pcat_1"],
        imageUrls: ["https://cdn.test/coffee-1.jpg"],
        priceAmount: 350,
        currencyCode: "etb",
        status: "draft",
        thumbnail: "",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(productInput, {
      title: "Coffee",
      description: "Roasted coffee beans",
      handle: "coffee",
      collectionId: "pcol_1",
      categoryIds: ["pcat_1"],
      imageUrls: ["https://cdn.test/coffee-1.jpg"],
      priceAmount: 350,
      currencyCode: "etb",
      regionId: "reg_1",
      status: "draft",
      thumbnail: null,
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
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
  });

  it("rejects merchant product creation without a title", async () => {
    let productCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        createMerchantProduct: async () => {
          productCalls += 1;

          return {
            ok: false,
            error: "commerce_backend_unavailable",
            status: 503,
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products", {
      body: JSON.stringify({ title: " " }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "missing_title",
    });
    assert.equal(productCalls, 0);
  });

  it("updates merchant products scoped to the resolved tenant sales channel", async () => {
    let productInput:
      | {
          categoryIds?: string[] | undefined;
          collectionId?: string | null | undefined;
          description?: string | null | undefined;
          handle?: string | null | undefined;
          imageUrls?: string[] | undefined;
          productId: string;
          salesChannelId: string;
          status?: string | null | undefined;
          thumbnail?: string | null | undefined;
          title?: string | null | undefined;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        updateMerchantProduct: async (input) => {
          productInput = input;

          return {
            ok: true,
            product: {
              id: input.productId,
              title: input.title ?? null,
              handle: input.handle ?? null,
              status: input.status ?? null,
              thumbnail: input.thumbnail ?? null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-03T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products/prod_1", {
      body: JSON.stringify({
        title: "Updated coffee",
        description: "Updated roasted coffee beans",
        handle: "updated-coffee",
        collectionId: "pcol_1",
        categoryIds: ["pcat_1", "pcat_2"],
        imageUrls: ["https://cdn.test/coffee-2.jpg"],
        status: "published",
        thumbnail: "",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(productInput, {
      productId: "prod_1",
      title: "Updated coffee",
      description: "Updated roasted coffee beans",
      handle: "updated-coffee",
      collectionId: "pcol_1",
      categoryIds: ["pcat_1", "pcat_2"],
      imageUrls: ["https://cdn.test/coffee-2.jpg"],
      status: "published",
      thumbnail: null,
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      product: {
        id: "prod_1",
        title: "Updated coffee",
        handle: "updated-coffee",
        status: "published",
        thumbnail: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    });
  });

  it("updates tenant products scoped to the selected tenant sales channel", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let productInput:
      | {
          categoryIds?: string[] | undefined;
          collectionId?: string | null | undefined;
          description?: string | null | undefined;
          handle?: string | null | undefined;
          imageUrls?: string[] | undefined;
          productId: string;
          salesChannelId: string;
          status?: string | null | undefined;
          thumbnail?: string | null | undefined;
          title?: string | null | undefined;
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
        updateMerchantProduct: async (input) => {
          productInput = input;

          return {
            ok: true,
            product: {
              id: input.productId,
              title: input.title ?? null,
              handle: input.handle ?? null,
              status: input.status ?? null,
              thumbnail: input.thumbnail ?? null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-03T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/products/prod_1", {
      body: JSON.stringify({
        title: "Updated coffee",
        description: "Updated roasted coffee beans",
        handle: "updated-coffee",
        collectionId: "pcol_1",
        categoryIds: ["pcat_1", "pcat_2"],
        imageUrls: ["https://cdn.test/coffee-2.jpg"],
        status: "published",
        thumbnail: "",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(productInput, {
      productId: "prod_1",
      title: "Updated coffee",
      description: "Updated roasted coffee beans",
      handle: "updated-coffee",
      collectionId: "pcol_1",
      categoryIds: ["pcat_1", "pcat_2"],
      imageUrls: ["https://cdn.test/coffee-2.jpg"],
      status: "published",
      thumbnail: null,
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      product: {
        id: "prod_1",
        title: "Updated coffee",
        handle: "updated-coffee",
        status: "published",
        thumbnail: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    });
  });

  it("requires a platform session for merchant product access", async () => {
    const app = appWithResolution({
      ok: true,
      context: resolvedTenantContext,
    });

    const response = await app.request("/platform/merchant/products", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "auth_required",
    });
  });

  it("returns a commerce setup error when merchant product routes lack a sales channel", async () => {
    let productCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: {
          ...resolvedTenantContext,
          medusaSalesChannelId: null,
        },
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        listMerchantProducts: async () => {
          productCalls += 1;

          return {
            ok: true,
            count: 0,
            limit: 20,
            offset: 0,
            products: [],
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "commerce_sales_channel_unavailable",
    });
    assert.equal(productCalls, 0);
  });

  it("returns a commerce setup error when merchant product creation lacks a region", async () => {
    let productCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: {
          ...resolvedTenantContext,
          medusaRegionId: null,
        },
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        createMerchantProduct: async () => {
          productCalls += 1;

          return {
            ok: false,
            error: "commerce_backend_unavailable",
            status: 503,
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products", {
      body: JSON.stringify({
        title: "Coffee",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "commerce_region_unavailable",
    });
    assert.equal(productCalls, 0);
  });

  it("rejects product access without active membership for the resolved tenant", async () => {
    let productCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({ ok: false }),
        getSession: async () => ({
          user: {
            id: "user_2",
            email: "stranger@example.com",
            name: "Stranger",
          },
        }),
        listMerchantProducts: async () => {
          productCalls += 1;

          return {
            ok: true,
            count: 0,
            limit: 20,
            offset: 0,
            products: [],
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "dashboard_forbidden",
    });
    assert.equal(productCalls, 0);
  });

  it("forwards resolved store requests to Medusa with the tenant publishable key", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json(
        {
          products: [],
        },
        {
          status: 200,
          headers: {
            "x-medusa-request-id": "medusa_req_1",
          },
        },
      );
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/products?limit=10", {
      headers: {
        Host: "abebe.lvh.me",
        "x-publishable-api-key": "client_supplied_key",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      products: [],
    });
    assert.equal(response.headers.get("x-medusa-request-id"), "medusa_req_1");
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/products?limit=10");
    assert.equal(forwardedRequest.headers.get("x-publishable-api-key"), "pk_1");
    assert.equal(forwardedRequest.headers.get("host"), null);
  });

  it("injects the resolved tenant region when forwarding cart creation", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);
      return Response.json({ cart: { id: "cart_1" } }, { status: 201 });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/carts", {
      method: "POST",
      body: JSON.stringify({ region_id: "reg_other", email: "buyer@example.com" }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 201);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.deepEqual(JSON.parse(await forwardedRequest.text()), {
      region_id: "reg_1",
      email: "buyer@example.com",
    });
  });

  it("does not create carts for tenants without a commerce region", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: {
          ...resolvedTenantContext,
          medusaRegionId: null,
        },
      },
      {
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/carts", {
      method: "POST",
      body: JSON.stringify({ email: "buyer@example.com" }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "commerce_region_unavailable",
    });
    assert.equal(fetchCalls, 0);
  });

  it("returns public delivery options for the resolved storefront host", async () => {
    let deliveryInput: { tenantId: string } | undefined;
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getDeliverySettings: async (input) => {
          deliveryInput = input;

          return {
            ok: true,
            delivery: {
              tenantId: input.tenantId,
              deliveryEnabled: true,
              pickupEnabled: true,
              phoneConfirmationRequired: true,
              notesEnabled: true,
              landmarkRequired: false,
              defaultDeliveryFee: "50.00",
              currency: "ETB",
              zones: [
                {
                  name: "Bole",
                  fee: "75.00",
                },
              ],
              updatedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/delivery", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(deliveryInput, {
      tenantId: "tenant_1",
    });
    assert.equal(fetchCalls, 0);
    assert.deepEqual(await response.json(), {
      delivery: {
        deliveryEnabled: true,
        pickupEnabled: true,
        phoneConfirmationRequired: true,
        notesEnabled: true,
        landmarkRequired: false,
        defaultDeliveryFee: "50.00",
        currency: "ETB",
        zones: [
          {
            name: "Bole",
            fee: "75.00",
          },
        ],
      },
    });
  });

  it("forwards cart shipping option reads to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        shipping_options: [
          {
            id: "so_1",
            name: "Local delivery",
            amount: 50,
          },
        ],
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/shipping-options?cart_id=cart_1", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      shipping_options: [
        {
          id: "so_1",
          name: "Local delivery",
          amount: 50,
        },
      ],
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/shipping-options?cart_id=cart_1");
    assert.equal(forwardedRequest.headers.get("x-publishable-api-key"), "pk_1");
  });

  it("forwards cart shipping method selection to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        cart: {
          id: "cart_1",
          shipping_methods: [
            {
              shipping_option_id: "so_1",
            },
          ],
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/carts/cart_1/shipping-methods", {
      body: JSON.stringify({
        option_id: "so_1",
        data: {
          delivery_choice: "delivery",
        },
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      cart: {
        id: "cart_1",
        shipping_methods: [
          {
            shipping_option_id: "so_1",
          },
        ],
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/carts/cart_1/shipping-methods");
    assert.equal(
      await forwardedRequest.text(),
      JSON.stringify({
        option_id: "so_1",
        data: {
          delivery_choice: "delivery",
        },
      }),
    );
  });

  it("forwards cart contact and address updates to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        cart: {
          id: "cart_1",
          email: "buyer@example.com",
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const body = {
      email: "buyer@example.com",
      shipping_address: {
        first_name: "Abebe",
        phone: "+251911111111",
        address_1: "Bole",
        city: "Addis Ababa",
        country_code: "et",
      },
      metadata: {
        delivery_choice: "delivery",
        landmark: "Near the mall",
        customer_notes: "Call before delivery",
      },
    };

    const response = await app.request("/store/carts/cart_1", {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      cart: {
        id: "cart_1",
        email: "buyer@example.com",
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/carts/cart_1");
    assert.equal(await forwardedRequest.text(), JSON.stringify(body));
  });

  it("forwards payment provider reads to Medusa with the resolved tenant region", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        payment_providers: [
          {
            id: "pp_system_default",
          },
        ],
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/payment-providers?region_id=reg_other", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      payment_providers: [
        {
          id: "pp_system_default",
        },
      ],
    });
    assert.ok(forwardedRequest);
    assert.equal(
      forwardedRequest.url,
      "http://medusa:9000/store/payment-providers?region_id=reg_1",
    );
    assert.equal(forwardedRequest.headers.get("x-publishable-api-key"), "pk_1");
  });

  it("completes a COD checkout through Medusa with tenant delivery metadata", async () => {
    const forwardedRequests: Request[] = [];
    const notificationEvents: {
      eventType: NotificationEventType;
      payload?: unknown;
      tenantId: string;
    }[] = [];
    const analyticsEvents: {
      eventType: string;
      idempotencyKey?: string | null | undefined;
      properties?: unknown;
      source: "medusa" | "platform" | "storefront";
      subjectId?: string | null | undefined;
      subjectType?: string | null | undefined;
      tenantId: string;
    }[] = [];
    const medusaStoreFetch: typeof fetch = async (request) => {
      const forwardedRequest = request instanceof Request ? request : new Request(request);
      forwardedRequests.push(forwardedRequest.clone());
      const path = new URL(forwardedRequest.url).pathname;

      if (path === "/store/payment-collections") {
        return Response.json({
          payment_collection: {
            id: "paycol_1",
          },
        });
      }

      if (path === "/store/carts/cart_1/complete") {
        return Response.json({
          type: "order",
          order: {
            id: "order_1",
          },
        });
      }

      return Response.json({
        cart: {
          id: "cart_1",
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getDeliverySettings: async (input) => ({
          ok: true,
          delivery: {
            tenantId: input.tenantId,
            deliveryEnabled: true,
            pickupEnabled: true,
            phoneConfirmationRequired: true,
            notesEnabled: true,
            landmarkRequired: true,
            defaultDeliveryFee: "50.00",
            currency: "ETB",
            zones: [],
            updatedAt: "2026-06-02T10:00:00.000Z",
          },
        }),
        medusaStoreFetch,
        recordNotificationEvent: async (input) => {
          notificationEvents.push(input);

          return {
            ok: true,
            logCount: 1,
            logIds: ["log_1"],
          };
        },
        recordAnalyticsEvent: async (input) => {
          analyticsEvents.push(input);

          return {
            ok: true,
            duplicate: false,
            event: {
              id: "event_1",
              eventType: input.eventType,
              occurredAt: "2026-01-01T12:00:00.000Z",
              receivedAt: "2026-01-01T12:00:01.000Z",
              source: input.source,
            },
          };
        },
      },
    );

    const response = await app.request("/store/checkout/cod", {
      body: JSON.stringify({
        cartId: "cart_1",
        shippingOptionId: "so_1",
        deliveryChoice: "delivery",
        customer: {
          name: "Abebe Kebede",
          phone: "+251911111111",
          email: "buyer@example.com",
        },
        address: {
          address1: "Bole Road",
          city: "Addis Ababa",
          landmark: "Near the mall",
        },
        notes: "Call before delivery",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      type: "order",
      order: {
        id: "order_1",
      },
    });
    assert.equal(forwardedRequests.length, 5);
    const updateCartRequest = forwardedRequests[0];
    const shippingMethodRequest = forwardedRequests[1];
    const paymentCollectionRequest = forwardedRequests[2];
    const paymentSessionRequest = forwardedRequests[3];

    assert.ok(updateCartRequest);
    assert.ok(shippingMethodRequest);
    assert.ok(paymentCollectionRequest);
    assert.ok(paymentSessionRequest);
    assert.deepEqual(
      forwardedRequests.map((request) => [request.method, new URL(request.url).pathname]),
      [
        ["POST", "/store/carts/cart_1"],
        ["POST", "/store/carts/cart_1/shipping-methods"],
        ["POST", "/store/payment-collections"],
        ["POST", "/store/payment-collections/paycol_1/payment-sessions"],
        ["POST", "/store/carts/cart_1/complete"],
      ],
    );
    assert.equal(updateCartRequest.headers.get("x-publishable-api-key"), "pk_1");
    assert.deepEqual(JSON.parse(await updateCartRequest.text()), {
      email: "buyer@example.com",
      shipping_address: {
        first_name: "Abebe Kebede",
        phone: "+251911111111",
        address_1: "Bole Road",
        city: "Addis Ababa",
        country_code: "et",
      },
      metadata: {
        checkout_type: "cod",
        payment_method: "cod",
        delivery_choice: "delivery",
        customer_name: "Abebe Kebede",
        customer_phone: "+251911111111",
        landmark: "Near the mall",
        customer_notes: "Call before delivery",
      },
    });
    assert.deepEqual(JSON.parse(await shippingMethodRequest.text()), {
      option_id: "so_1",
      data: {
        delivery_choice: "delivery",
        landmark: "Near the mall",
        customer_notes: "Call before delivery",
      },
    });
    assert.deepEqual(JSON.parse(await paymentCollectionRequest.text()), {
      cart_id: "cart_1",
    });
    assert.deepEqual(JSON.parse(await paymentSessionRequest.text()), {
      provider_id: "pp_system_default",
      data: {
        payment_method: "cod",
      },
    });
    assert.deepEqual(notificationEvents, [
      {
        eventType: "cod_order.created",
        payload: {
          cartId: "cart_1",
          deliveryChoice: "delivery",
          orderId: "order_1",
        },
        tenantId: "tenant_1",
      },
      {
        eventType: "order.created",
        payload: {
          cartId: "cart_1",
          deliveryChoice: "delivery",
          orderId: "order_1",
          paymentMethod: "cod",
        },
        tenantId: "tenant_1",
      },
    ]);
    assert.deepEqual(analyticsEvents, [
      {
        eventType: "order.created",
        idempotencyKey: "cod:cart_1:order.created",
        properties: {
          cartId: "cart_1",
          deliveryChoice: "delivery",
          orderId: "order_1",
          paymentMethod: "cod",
        },
        source: "platform",
        subjectId: "order_1",
        subjectType: "order",
        tenantId: "tenant_1",
      },
    ]);
  });

  it("rejects store Chapa checkout when merchant credentials are missing", async () => {
    let medusaCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getMerchantChapaCredentials: async () => ({
          ok: false as const,
          error: "merchant_chapa_not_configured" as const,
        }),
        medusaStoreFetch: async () => {
          medusaCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/checkout/chapa", {
      body: JSON.stringify({
        cartId: "cart_1",
        returnUrl: "http://abebe.lvh.me/checkout/return",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "merchant_chapa_not_configured",
    });
    assert.equal(medusaCalls, 0);
  });

  it("returns payment options with chapa only when merchant credentials exist", async () => {
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        isMerchantChapaConfigured: async () => true,
      },
    );

    const response = await app.request("/store/payment-options", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      payment: {
        cod: true,
        chapa: true,
      },
    });
  });

  it("does not complete COD checkout when tenant delivery is disabled", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getDeliverySettings: async (input) => ({
          ok: true,
          delivery: {
            tenantId: input.tenantId,
            deliveryEnabled: false,
            pickupEnabled: true,
            phoneConfirmationRequired: true,
            notesEnabled: true,
            landmarkRequired: false,
            defaultDeliveryFee: "50.00",
            currency: "ETB",
            zones: [],
            updatedAt: "2026-06-02T10:00:00.000Z",
          },
        }),
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/checkout/cod", {
      body: JSON.stringify({
        cartId: "cart_1",
        shippingOptionId: "so_1",
        deliveryChoice: "delivery",
        customer: {
          name: "Abebe Kebede",
          phone: "+251911111111",
        },
        address: {
          address1: "Bole Road",
          city: "Addis Ababa",
        },
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "delivery_unavailable",
    });
    assert.equal(fetchCalls, 0);
  });

  it("forwards payment session initialization to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        payment_collection: {
          id: "paycol_1",
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/payment-collections/paycol_1/payment-sessions", {
      body: JSON.stringify({
        provider_id: "pp_system_default",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      payment_collection: {
        id: "paycol_1",
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(
      forwardedRequest.url,
      "http://medusa:9000/store/payment-collections/paycol_1/payment-sessions",
    );
    assert.equal(
      await forwardedRequest.text(),
      JSON.stringify({
        provider_id: "pp_system_default",
      }),
    );
  });

  it("forwards cart completion to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        type: "order",
        order: {
          id: "order_1",
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/carts/cart_1/complete", {
      headers: {
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      type: "order",
      order: {
        id: "order_1",
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/carts/cart_1/complete");
  });

  it("does not forward unsupported store facade routes", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/plugins/internal", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "store_route_not_allowed",
    });
    assert.equal(fetchCalls, 0);
  });

  it("does not forward resolved tenants without a publishable key", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: {
          ...resolvedTenantContext,
          medusaPublishableKeyId: null,
        },
      },
      {
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/products", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "domain_misconfigured",
    });
    assert.equal(fetchCalls, 0);
  });

  it("returns commerce_backend_unavailable when Medusa cannot be reached", async () => {
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        medusaStoreFetch: async () => {
          throw new TypeError("fetch failed");
        },
      },
    );

    const response = await app.request("/store/products", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "commerce_backend_unavailable",
    });
  });
});
