import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("merchant inventory", () => {
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

  it("applies bounded merchant inventory batches with ordered partial outcomes", async () => {
    const stockInputs: Array<{
      productId: string;
      salesChannelId: string;
      stockLocationId: string;
      stockedQuantity: number;
      variantId: string;
    }> = [];
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        updateMerchantProductVariantStock: async (input) => {
          stockInputs.push(input);
          return input.productId === "prod_1"
            ? {
                ok: true,
                stock: {
                  productId: input.productId,
                  variantId: input.variantId,
                  inventoryItemId: "ii_1",
                  locationId: input.stockLocationId,
                  stockedQuantity: input.stockedQuantity,
                  reservedQuantity: 0,
                  incomingQuantity: 0,
                  availableQuantity: input.stockedQuantity,
                },
              }
            : { ok: false, error: "product_not_found", status: 404 };
        },
      },
    );

    const response = await app.request("/platform/merchant/products/inventory/batch", {
      body: JSON.stringify({
        updates: [
          { productId: "prod_1", variantId: "var_1", stockedQuantity: 12 },
          { productId: "prod_missing", variantId: "var_2", stockedQuantity: 3 },
        ],
      }),
      headers: { "content-type": "application/json", Host: "abebe.lvh.me" },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(
      stockInputs.map(
        ({ productId, salesChannelId, stockLocationId, stockedQuantity, variantId }) => ({
          productId,
          salesChannelId,
          stockLocationId,
          stockedQuantity,
          variantId,
        }),
      ),
      [
        {
          productId: "prod_1",
          salesChannelId: "channel_1",
          stockLocationId: "sloc_1",
          stockedQuantity: 12,
          variantId: "var_1",
        },
        {
          productId: "prod_missing",
          salesChannelId: "channel_1",
          stockLocationId: "sloc_1",
          stockedQuantity: 3,
          variantId: "var_2",
        },
      ],
    );
    const data = (await response.json()) as {
      succeeded: number;
      failed: number;
      results: unknown[];
    };
    assert.equal(data.succeeded, 1);
    assert.equal(data.failed, 1);
    assert.equal(data.results.length, 2);
  });
});
