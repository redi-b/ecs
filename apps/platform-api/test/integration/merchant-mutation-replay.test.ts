import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createInMemoryMerchantMutationStore,
  createMerchantMutationReplayService,
} from "../../src/modules/commerce/merchant-mutation-replay.js";
import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

const authorization = {
  authorizeDashboardForTenant: async () => ({
    ok: true as const,
    actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
  }),
  getSession: async () => ({
    user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
  }),
};

describe("merchant mutation replay routes", () => {
  it("replays an assisted sale without creating a second Medusa order", async () => {
    const replay = createMerchantMutationReplayService({
      store: createInMemoryMerchantMutationStore(),
    });
    let creates = 0;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        ...authorization,
        executeMerchantMutation: replay.execute,
        createMerchantManualOrder: async () => {
          creates += 1;
          return {
            ok: true,
            order: { id: "order_1", displayId: 1001, status: "pending" },
          };
        },
      },
    );
    const request = () =>
      app.request("/platform/merchant/manual-orders", {
        body: JSON.stringify({
          customerPhone: "+251911234567",
          items: [{ quantity: 1, variantId: "variant_1" }],
        }),
        headers: {
          "content-type": "application/json",
          Host: "abebe.lvh.me",
          "Idempotency-Key": "assist-route-1",
        },
        method: "POST",
      });

    const first = await request();
    const second = await request();

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(second.headers.get("x-idempotent-replay"), "true");
    assert.equal(creates, 1);
    assert.deepEqual(await second.json(), await first.json());
  });

  it("replays a refund without issuing a second Medusa refund", async () => {
    const replay = createMerchantMutationReplayService({
      store: createInMemoryMerchantMutationStore(),
    });
    let refunds = 0;
    const order = {
      id: "order_1",
      displayId: 1001,
      email: "buyer@example.com",
      status: "pending",
      paymentStatus: "partially_refunded",
      fulfillmentStatus: "not_fulfilled",
      currencyCode: "etb",
      total: 1000,
      items: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        ...authorization,
        executeMerchantMutation: replay.execute,
        mutateMerchantOrder: async () => {
          refunds += 1;
          return { ok: true, order };
        },
      },
    );
    const request = () =>
      app.request("/platform/merchant/orders/order_1/refund", {
        body: JSON.stringify({ amount: 100, method: "cash", reason: "customer_request" }),
        headers: {
          "content-type": "application/json",
          Host: "abebe.lvh.me",
          "Idempotency-Key": "refund-route-1",
        },
        method: "POST",
      });

    const first = await request();
    const second = await request();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get("x-idempotent-replay"), "true");
    assert.equal(refunds, 1);
    assert.deepEqual(await second.json(), await first.json());
  });

  it("replays mark-paid without capturing payment twice", async () => {
    const replay = createMerchantMutationReplayService({
      store: createInMemoryMerchantMutationStore(),
    });
    let captures = 0;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        ...authorization,
        executeMerchantMutation: replay.execute,
        mutateMerchantOrder: async () => {
          captures += 1;
          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "buyer@example.com",
              status: "pending",
              paymentStatus: "captured",
              fulfillmentStatus: "not_fulfilled",
              currencyCode: "etb",
              total: 1000,
              items: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          };
        },
      },
    );
    const request = () =>
      app.request("/platform/merchant/orders/order_1/mark-paid", {
        body: JSON.stringify({ settlementMethod: "cash" }),
        headers: {
          "content-type": "application/json",
          Host: "abebe.lvh.me",
          "Idempotency-Key": "mark-paid-route-1",
        },
        method: "POST",
      });

    const first = await request();
    const second = await request();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get("x-idempotent-replay"), "true");
    assert.equal(captures, 1);
  });

  it("replays a stock set without writing Medusa inventory twice", async () => {
    const replay = createMerchantMutationReplayService({
      store: createInMemoryMerchantMutationStore(),
    });
    let writes = 0;
    let movements = 0;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        ...authorization,
        appendMerchantInventoryMovement: async (input) => {
          movements += 1;
          return { movement: { ...input, createdAt: "2026-09-29T10:00:00.000Z", id: "movement_1" } };
        },
        executeMerchantMutation: replay.execute,
        getMerchantProductVariantStock: async (input) => ({
          ok: true,
          stock: {
            availableQuantity: 10,
            incomingQuantity: 0,
            inventoryItemId: "iitem_1",
            locationId: input.stockLocationId,
            productId: input.productId,
            reservedQuantity: 0,
            stockedQuantity: 10,
            variantId: input.variantId,
          },
        }),
        updateMerchantProductVariantStock: async (input) => {
          writes += 1;
          return {
            ok: true,
            stock: {
              availableQuantity: input.stockedQuantity,
              incomingQuantity: 0,
              inventoryItemId: "iitem_1",
              locationId: input.stockLocationId,
              productId: input.productId,
              reservedQuantity: 0,
              stockedQuantity: input.stockedQuantity,
              variantId: input.variantId,
            },
          };
        },
      },
    );
    const request = () =>
      app.request("/platform/merchant/products/prod_1/variants/variant_1/stock", {
        body: JSON.stringify({ stockedQuantity: 24 }),
        headers: {
          "content-type": "application/json",
          Host: "abebe.lvh.me",
          "Idempotency-Key": "stock-route-1",
        },
        method: "POST",
      });

    const first = await request();
    const second = await request();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get("x-idempotent-replay"), "true");
    assert.equal(writes, 1);
    assert.equal(movements, 1);
    assert.deepEqual(await second.json(), await first.json());
  });

  it("replays the exact partial result of a batch stock update", async () => {
    const replay = createMerchantMutationReplayService({
      store: createInMemoryMerchantMutationStore(),
    });
    let writes = 0;
    let movements = 0;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        ...authorization,
        appendMerchantInventoryMovement: async (input) => {
          movements += 1;
          return { movement: { ...input, createdAt: "2026-09-29T10:00:00.000Z", id: `movement_${movements}` } };
        },
        executeMerchantMutation: replay.execute,
        getMerchantProductVariantStock: async (input) => ({
          ok: true,
          stock: {
            availableQuantity: 2,
            incomingQuantity: 0,
            inventoryItemId: `iitem_${input.variantId}`,
            locationId: input.stockLocationId,
            productId: input.productId,
            reservedQuantity: 0,
            stockedQuantity: 2,
            variantId: input.variantId,
          },
        }),
        updateMerchantProductVariantStock: async (input) => {
          writes += 1;
          if (input.variantId === "variant_bad") {
            return { ok: false, error: "commerce_backend_error", status: 502 };
          }
          return {
            ok: true,
            stock: {
              availableQuantity: input.stockedQuantity,
              incomingQuantity: 0,
              inventoryItemId: `iitem_${input.variantId}`,
              locationId: input.stockLocationId,
              productId: input.productId,
              reservedQuantity: 0,
              stockedQuantity: input.stockedQuantity,
              variantId: input.variantId,
            },
          };
        },
      },
    );
    const request = () =>
      app.request("/platform/merchant/products/inventory/batch", {
        body: JSON.stringify({
          updates: [
            { productId: "prod_1", stockedQuantity: 5, variantId: "variant_1" },
            { productId: "prod_2", stockedQuantity: 7, variantId: "variant_bad" },
          ],
        }),
        headers: {
          "content-type": "application/json",
          Host: "abebe.lvh.me",
          "Idempotency-Key": "batch-stock-route-1",
        },
        method: "POST",
      });

    const first = await request();
    const second = await request();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get("x-idempotent-replay"), "true");
    assert.equal(writes, 2);
    assert.equal(movements, 1);
    assert.deepEqual(await second.json(), await first.json());
  });
});
