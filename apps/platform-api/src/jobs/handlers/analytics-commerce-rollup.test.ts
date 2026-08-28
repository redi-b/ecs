import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAnalyticsCommerceRollupHandler } from "./analytics-commerce-rollup.js";

describe("analytics commerce rollup handler", () => {
  it("rolls up every eligible tenant with one shared watermark", async () => {
    const scopes: string[] = [];
    const writes: Array<{ tenantId: string; watermark: Date }> = [];
    const handler = createAnalyticsCommerceRollupHandler({
      db: {} as never,
      listOrders: async (input) => {
        scopes.push(input.salesChannelId);
        return { ok: true, count: 0, limit: input.limit, offset: input.offset, orders: [] };
      },
      listProducts: async (input) => ({
        ok: true,
        count: 0,
        limit: input.limit,
        offset: input.offset,
        products: [],
      }),
      listTenants: async () => [
        { salesChannelId: "channel_1", tenantId: "tenant_1" },
        { salesChannelId: "channel_2", tenantId: "tenant_2" },
      ],
      now: () => new Date("2026-08-25T12:00:00.000Z"),
      writeRollup: async (input) => {
        writes.push({ tenantId: input.tenantId, watermark: input.watermark });
      },
      writeSnapshot: async () => undefined,
    });

    const result = await handler({
      attempt: 1,
      jobRunId: "job_1",
      name: "analytics.commerce-rollup",
      payload: {},
      tenantId: null,
    });

    assert.deepEqual(scopes, ["channel_1", "channel_1", "channel_2", "channel_2"]);
    assert.deepEqual(writes, [
      { tenantId: "tenant_1", watermark: new Date("2026-08-25T12:00:00.000Z") },
      { tenantId: "tenant_2", watermark: new Date("2026-08-25T12:00:00.000Z") },
    ]);
    assert.deepEqual(result, {
      ok: true,
      rows: 8,
      sourceOrders: 0,
      tenants: 2,
      watermark: "2026-08-25T12:00:00.000Z",
    });
  });

  it("limits a merchant-requested run to the authorized tenant", async () => {
    const scopes: string[] = [];
    const handler = createAnalyticsCommerceRollupHandler({
      db: {} as never,
      listOrders: async (input) => {
        scopes.push(input.salesChannelId);
        return { ok: true, count: 0, limit: input.limit, offset: input.offset, orders: [] };
      },
      listProducts: async (input) => ({
        ok: true,
        count: 0,
        limit: input.limit,
        offset: input.offset,
        products: [],
      }),
      listTenants: async () => [
        { salesChannelId: "channel_1", tenantId: "tenant_1" },
        { salesChannelId: "channel_2", tenantId: "tenant_2" },
      ],
      writeRollup: async () => undefined,
      writeSnapshot: async () => undefined,
    });

    const result = await handler({
      attempt: 1,
      jobRunId: "job_2",
      name: "analytics.commerce-rollup",
      payload: { source: "merchant" },
      tenantId: "tenant_2",
    });

    assert.deepEqual(scopes, ["channel_2", "channel_2"]);
    assert.equal((result as { tenants: number }).tenants, 1);
  });
});
