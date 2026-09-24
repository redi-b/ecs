import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("merchant product writes", () => {
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
      shippingProfileId: "shp_1",
      status: "draft",
      stockLocationId: "sloc_1",
      tenantId: "tenant_1",
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
      mediaSyncWarning: true,
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
      tenantId: "tenant_1",
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
      regionId: "reg_1",
      status: "published",
      stockLocationId: "sloc_1",
      tenantId: "tenant_1",
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
      mediaSyncWarning: true,
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
      regionId: "reg_1",
      status: "published",
      tenantId: "tenant_1",
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
});
