import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { registerPlatformInternalNotificationRoutes } from "./internal-notifications.js";

function createTestApp(options: Partial<PlatformAppOptions>) {
  const app = new Hono<{ Variables: PlatformAppVariables }>();
  registerPlatformInternalNotificationRoutes(app, {
    serviceName: "test",
    medusaInternalUrl: "http://medusa",
    platformPublicBaseUrl: "http://api",
    resolveTenantForHost: async () => ({ kind: "not_found" as const }),
    internalApiToken: "secret",
    ...options,
  } as PlatformAppOptions);
  return app;
}

describe("POST /platform/internal/notifications/events", () => {
  it("rejects missing token", async () => {
    const app = createTestApp({
      recordNotificationEvent: async () => ({ ok: true, logCount: 0, logIds: [] }),
    });
    const res = await app.request("/platform/internal/notifications/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "order.created",
        tenantId: "t1",
      }),
    });
    assert.equal(res.status, 401);
  });

  it("resolves tenant from medusaSalesChannelId", async () => {
    const recorded: unknown[] = [];
    const app = createTestApp({
      resolveTenantIdByMedusaSalesChannelId: async (id) =>
        id === "sc_1" ? "tenant-from-sc" : null,
      recordNotificationEvent: async (input) => {
        recorded.push(input);
        return { ok: true, logCount: 1, logIds: ["log1"] };
      },
    });

    const res = await app.request("/platform/internal/notifications/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-platform-internal-token": "secret",
      },
      body: JSON.stringify({
        eventType: "order.created",
        medusaSalesChannelId: "sc_1",
        payload: { orderId: "o1" },
      }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.tenantId, "tenant-from-sc");
    assert.equal(json.logCount, 1);
    assert.deepEqual(recorded[0], {
      tenantId: "tenant-from-sc",
      eventType: "order.created",
      payload: { orderId: "o1" },
    });
  });

  it("returns 404 when sales channel is unknown", async () => {
    const app = createTestApp({
      resolveTenantIdByMedusaSalesChannelId: async () => null,
      recordNotificationEvent: async () => ({ ok: true, logCount: 0, logIds: [] }),
    });
    const res = await app.request("/platform/internal/notifications/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-platform-internal-token": "secret",
      },
      body: JSON.stringify({
        eventType: "order.created",
        medusaSalesChannelId: "unknown",
      }),
    });
    assert.equal(res.status, 404);
  });
});
