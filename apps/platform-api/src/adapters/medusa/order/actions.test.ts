import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MerchantOrder } from "../../../types/index.js";
import { deliverMerchantOrderFulfillment, shipMerchantOrderFulfillment } from "./actions.js";

function order(partial: Partial<MerchantOrder> = {}): MerchantOrder {
  return {
    id: "order_1", displayId: 1, email: "buyer@example.com", status: "pending",
    paymentStatus: "not_paid", fulfillmentStatus: "fulfilled", currencyCode: "etb",
    total: 100, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
    delivery: { choice: "delivery", customerName: null, customerPhone: null, landmark: null, notes: null },
    fulfillments: [{ id: "ful_1", shippedAt: null, deliveredAt: null, canceledAt: null }],
    ...partial,
  };
}

const options = { adminApiToken: "token", medusaInternalUrl: "http://medusa.local" };

describe("order fulfillment transitions", () => {
  it("does not create shipments for pickup orders", async () => {
    const result = await shipMerchantOrderFulfillment(async () => { throw new Error("must not fetch"); }, options, {
      order: order({ delivery: { choice: "pickup", customerName: null, customerPhone: null, landmark: null, notes: null } }),
      orderId: "order_1", fulfillmentId: "ful_1", salesChannelId: "sc_1",
    });
    assert.deepEqual(result, { ok: false, error: "order_action_invalid", status: 400 });
  });

  it("treats an already-created shipment as idempotent", async () => {
    const current = order({ fulfillments: [{ id: "ful_1", shippedAt: "2026-09-01T01:00:00.000Z", deliveredAt: null, canceledAt: null }] });
    const result = await shipMerchantOrderFulfillment(async () => { throw new Error("must not fetch"); }, options, {
      order: current, orderId: "order_1", fulfillmentId: "ful_1", salesChannelId: "sc_1",
    });
    assert.equal(result.ok, true);
  });

  it("requires shipment before a delivery can be marked delivered", async () => {
    const deliveryResult = await deliverMerchantOrderFulfillment(async () => { throw new Error("must not fetch"); }, options, {
      order: order(), orderId: "order_1", fulfillmentId: "ful_1", salesChannelId: "sc_1",
    });
    assert.deepEqual(deliveryResult, { ok: false, error: "order_not_fulfillable", status: 409 });
  });
});
