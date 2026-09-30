import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { registerPlatformInternalOrderCostRoutes } from "./internal-order-costs.js";

function createTestApp(options: Partial<PlatformAppOptions>) {
  const app = new Hono<{ Variables: PlatformAppVariables }>();
  registerPlatformInternalOrderCostRoutes(app, {
    internalApiToken: "secret",
    ...options,
  } as PlatformAppOptions);
  return app;
}

describe("POST /platform/internal/orders/cost-snapshots", () => {
  const body = {
    items: [
      { lineItemId: "item_1", quantity: 2, unitCostAmount: 90, variantId: "variant_1" },
      { lineItemId: "item_2", quantity: 1, unitCostAmount: null, variantId: null },
    ],
    medusaSalesChannelId: "channel_1",
    orderId: "order_1",
    orderPlacedAt: "2026-09-30T09:00:00.000Z",
  };

  it("requires the internal token", async () => {
    const app = createTestApp({});
    const response = await app.request("/platform/internal/orders/cost-snapshots", {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 401);
  });

  it("resolves the tenant from the sales channel and captures tenant-bound rows", async () => {
    const captured: unknown[] = [];
    const app = createTestApp({
      captureMerchantOrderCosts: async (input) => {
        captured.push(input);
        return { captured: input.items.length };
      },
      resolveTenantIdByMedusaSalesChannelId: async (salesChannelId) => {
        assert.equal(salesChannelId, "channel_1");
        return "tenant_1";
      },
    });
    const request = () =>
      app.request("/platform/internal/orders/cost-snapshots", {
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
          "x-platform-internal-token": "secret",
        },
        method: "POST",
      });

    assert.equal((await request()).status, 201);
    assert.equal((await request()).status, 201);
    assert.equal(captured.length, 2);
    assert.deepEqual(captured[0], {
      items: [
        {
          currencyCode: "etb",
          lineItemId: "item_1",
          orderId: "order_1",
          orderPlacedAt: "2026-09-30T09:00:00.000Z",
          quantity: 2,
          tenantId: "tenant_1",
          unitCostAmount: 90,
          variantId: "variant_1",
        },
        {
          currencyCode: "etb",
          lineItemId: "item_2",
          orderId: "order_1",
          orderPlacedAt: "2026-09-30T09:00:00.000Z",
          quantity: 1,
          tenantId: "tenant_1",
          unitCostAmount: null,
          variantId: null,
        },
      ],
      tenantId: "tenant_1",
    });
  });

  it("does not accept a tenant id from the caller", async () => {
    const app = createTestApp({
      captureMerchantOrderCosts: async () => ({ captured: 0 }),
      resolveTenantIdByMedusaSalesChannelId: async () => "tenant_1",
    });
    const response = await app.request("/platform/internal/orders/cost-snapshots", {
      body: JSON.stringify({ ...body, tenantId: "attacker_tenant" }),
      headers: {
        "content-type": "application/json",
        "x-platform-internal-token": "secret",
      },
      method: "POST",
    });
    assert.equal(response.status, 400);
  });
});
