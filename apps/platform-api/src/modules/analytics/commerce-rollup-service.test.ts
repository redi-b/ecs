import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantOrder } from "../../types/merchant-order.js";
import { runCommerceRollup } from "./commerce-rollup-service.js";

describe("commerce rollup service", () => {
  it("paginates a tenant sales channel and writes one deterministic replacement", async () => {
    const calls: Array<{ limit: number; offset: number; salesChannelId: string }> = [];
    const writes: unknown[] = [];
    const orders = Array.from({ length: 125 }, (_, index) => order(`order_${index}`));
    const result = await runCommerceRollup({
      from: new Date("2026-08-01T00:00:00.000Z"),
      listOrders: async (input) => {
        calls.push(input);
        return {
          ok: true,
          count: orders.length,
          limit: input.limit,
          offset: input.offset,
          orders: orders.slice(input.offset, input.offset + input.limit),
        };
      },
      salesChannelId: "channel_1",
      tenantId: "tenant_1",
      to: new Date("2026-09-01T00:00:00.000Z"),
      writeRollup: async (input) => {
        writes.push(input);
      },
    });

    assert.deepEqual(calls, [
      { ...calls[0], limit: 100, offset: 0, salesChannelId: "channel_1" },
      { ...calls[1], limit: 100, offset: 100, salesChannelId: "channel_1" },
    ]);
    assert.deepEqual(result, {
      ok: true,
      rowCount: 5,
      sourceOrderCount: 125,
      watermark: "2026-09-01T00:00:00.000Z",
    });
    assert.equal(writes.length, 1);
  });

  it("fails before writing when the bounded source exceeds 10,000 orders", async () => {
    let writes = 0;
    const result = await runCommerceRollup({
      from: new Date("2026-01-01T00:00:00.000Z"),
      listOrders: async () => ({ ok: true, count: 10_001, limit: 100, offset: 0, orders: [] }),
      salesChannelId: "channel_1",
      tenantId: "tenant_1",
      to: new Date("2027-01-01T00:00:00.000Z"),
      writeRollup: async () => {
        writes += 1;
      },
    });

    assert.deepEqual(result, { ok: false, error: "commerce_rollup_too_large", status: 413 });
    assert.equal(writes, 0);
  });
});

function order(id: string): MerchantOrder {
  return {
    createdAt: "2026-08-25T08:00:00.000Z",
    currencyCode: "ETB",
    displayId: 1,
    email: `${id}@example.com`,
    fulfillmentStatus: "not_fulfilled",
    id,
    paymentStatus: "captured",
    status: "pending",
    total: 100,
    updatedAt: "2026-08-25T08:00:00.000Z",
  };
}
