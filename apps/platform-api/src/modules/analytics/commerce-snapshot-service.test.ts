import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantProduct } from "@ecs/contracts";

import type { MerchantOrder } from "../../types/index.js";
import { runCommerceSnapshot } from "./commerce-snapshot-service.js";

describe("commerce snapshot service", () => {
  it("scans beyond one page and writes one combined tenant snapshot", async () => {
    const orders = Array.from({ length: 130 }, (_, index) => order(`order_${index}`));
    const products = Array.from({ length: 115 }, (_, index) => product(`product_${index}`));
    const orderOffsets: number[] = [];
    const productOffsets: number[] = [];
    const writes: unknown[] = [];
    const result = await runCommerceSnapshot({
      listOrders: async (input) => {
        orderOffsets.push(input.offset);
        return {
          ok: true,
          count: orders.length,
          limit: input.limit,
          offset: input.offset,
          orders: orders.slice(input.offset, input.offset + input.limit),
        };
      },
      listProducts: async (input) => {
        productOffsets.push(input.offset);
        return {
          ok: true,
          count: products.length,
          limit: input.limit,
          offset: input.offset,
          products: products.slice(input.offset, input.offset + input.limit),
        };
      },
      observedAt: new Date("2026-08-25T21:30:00.000Z"),
      salesChannelId: "channel_1",
      tenantId: "tenant_1",
      writeSnapshot: async (input) => {
        writes.push(input);
      },
    });

    assert.deepEqual(orderOffsets, [0, 100]);
    assert.deepEqual(productOffsets, [0, 100]);
    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.orderCount : 0, 130);
    assert.equal(result.ok ? result.productCount : 0, 115);
    assert.equal(writes.length, 1);
  });

  it("does not write a partial snapshot when either source fails", async () => {
    let writes = 0;
    const result = await runCommerceSnapshot({
      listOrders: async () => ({
        ok: false,
        error: "commerce_backend_unavailable",
        status: 503,
      }),
      listProducts: async () => ({ ok: true, count: 0, limit: 100, offset: 0, products: [] }),
      observedAt: new Date("2026-08-25T12:00:00.000Z"),
      salesChannelId: "channel_1",
      tenantId: "tenant_1",
      writeSnapshot: async () => {
        writes += 1;
      },
    });

    assert.equal(result.ok, false);
    assert.equal(writes, 0);
  });
});

function order(id: string): MerchantOrder {
  return {
    createdAt: "2026-08-25T08:00:00.000Z",
    currencyCode: "ETB",
    displayId: 1,
    email: null,
    fulfillmentStatus: "not_fulfilled",
    id,
    paymentStatus: "not_paid",
    status: "pending",
    total: 0,
    updatedAt: "2026-08-25T08:00:00.000Z",
  };
}

function product(id: string): MerchantProduct {
  return {
    createdAt: null,
    handle: id,
    id,
    status: "published",
    thumbnail: null,
    title: id,
    updatedAt: null,
  };
}
