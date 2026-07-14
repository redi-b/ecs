import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOrderNotificationPayload,
  emitPlatformNotificationEvent,
  medusaToPlatformNotificationEvent,
} from "./platform-notifications";

describe("medusaToPlatformNotificationEvent", () => {
  it("maps core commerce events to platform allowlist types", () => {
    assert.equal(medusaToPlatformNotificationEvent["order.placed"], "order.created");
    assert.equal(medusaToPlatformNotificationEvent["order.canceled"], "order.cancelled");
    assert.equal(medusaToPlatformNotificationEvent["payment.captured"], "payment.paid");
  });
});

describe("buildOrderNotificationPayload", () => {
  it("keeps a small safe payload", () => {
    const payload = buildOrderNotificationPayload({
      id: "ord_1",
      display_id: 42,
      total: 120000,
      currency_code: "etb",
      sales_channel_id: "sc_1",
      email: "buyer@example.com",
    });

    assert.equal(payload.orderId, "ord_1");
    assert.equal(payload.orderDisplayId, "42");
    assert.equal(payload.medusaSalesChannelId, "sc_1");
    assert.equal(payload.amount, "120000");
  });
});

describe("emitPlatformNotificationEvent", () => {
  it("posts to platform internal ingest with token and sales channel", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];

    process.env.PLATFORM_API_INTERNAL_URL = "http://platform.test";
    process.env.PLATFORM_INTERNAL_API_TOKEN = "test-token";

    const result = await emitPlatformNotificationEvent(
      {
        eventType: "order.created",
        medusaSalesChannelId: "sc_abc",
        sourceEventId: "ord_1",
        payload: { orderId: "ord_1" },
      },
      {
        fetchImpl: async (url, init) => {
          calls.push({ url: String(url), init: init ?? {} });
          return new Response(JSON.stringify({ ok: true, logCount: 1, logIds: ["l1"] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    );

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "http://platform.test/platform/internal/notifications/events");
    assert.equal(
      (calls[0]?.init.headers as Record<string, string>)["x-platform-internal-token"],
      "test-token",
    );
    const body = JSON.parse(String(calls[0]?.init.body));
    assert.equal(body.eventType, "order.created");
    assert.equal(body.medusaSalesChannelId, "sc_abc");
    assert.equal(body.sourceEventId, "ord_1");
  });

  it("returns error when sales channel is missing", async () => {
    const result = await emitPlatformNotificationEvent({
      eventType: "order.created",
      medusaSalesChannelId: "  ",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "sales_channel_id_required");
    }
  });
});
