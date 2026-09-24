import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createResendEmailNotificationProvider,
  isEmailDeliveryConfigured,
  normalizeResendTags,
} from "./email-provider.js";

describe("createResendEmailNotificationProvider", () => {
  it("sends via Resend API and returns a provider reference", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = createResendEmailNotificationProvider({
      apiKey: "re_test",
      from: "alerts@example.com",
      senders: {
        fallback: "alerts@example.com",
        profiles: {
          accounts: "ECS Accounts <accounts@example.com>",
          billing: "billing@example.com",
          notifications: "alerts@example.com",
          orders: "orders@example.com",
        },
        supportReplyTo: null,
      },
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ id: "msg_123" }), { status: 200 });
      },
    });

    const result = await provider.send({
      channel: "email",
      tenantId: "tenant_1",
      recipient: "owner@shop.com",
      eventType: "order.created",
      subject: "New order",
      body: "You have a new order.\nOrder: #10",
      html: "<b>You have a new order.</b>\n<b>Order:</b> #10",
      idempotencyKey: "email-delivery-1",
      senderProfile: "orders",
    });

    assert.equal(result.providerReference, "resend:msg_123");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://api.resend.com/emails");
    const body = JSON.parse(String(calls[0]?.init.body));
    assert.equal(body.from, "orders@example.com");
    assert.equal(new Headers(calls[0]?.init.headers).get("idempotency-key"), "email-delivery-1");
    assert.deepEqual(body.to, ["owner@shop.com"]);
    assert.equal(body.subject, "New order");
    assert.equal(body.text, "You have a new order.\nOrder: #10");
    assert.match(body.html, /<b>You have a new order\.<\/b>/);
    assert.equal(body.html, "<b>You have a new order.</b>\n<b>Order:</b> #10");
  });

  it("normalizes application identifiers into Resend-safe tags", async () => {
    const requests: RequestInit[] = [];
    const provider = createResendEmailNotificationProvider({
      apiKey: "re_test",
      from: "alerts@example.com",
      fetchImpl: async (_url, init) => {
        requests.push(init ?? {});
        return new Response(JSON.stringify({ id: "msg_123" }), { status: 200 });
      },
    });

    await provider.send({
      body: "Order confirmed",
      channel: "email",
      eventType: "order.created",
      recipient: "customer@example.com",
      tags: {
        "event.type": "order.created",
        template: "customer.order_confirmation",
      },
      tenantId: "tenant_1",
    });

    const body = JSON.parse(String(requests[0]?.body));
    assert.deepEqual(body.tags, [
      { name: "event_type", value: "order_created" },
      { name: "template", value: "customer_order_confirmation" },
    ]);
  });

  it("throws on provider error responses", async () => {
    const provider = createResendEmailNotificationProvider({
      apiKey: "re_test",
      from: "alerts@example.com",
      fetchImpl: async () =>
        new Response(JSON.stringify({ message: "Invalid from address" }), { status: 422 }),
    });

    await assert.rejects(
      () =>
        provider.send({
          channel: "email",
          tenantId: "tenant_1",
          recipient: "owner@shop.com",
          eventType: "notification.test",
          body: "Test",
        }),
      /Invalid from address/,
    );
  });
});

describe("normalizeResendTags", () => {
  it("drops tag parts that contain no supported characters", () => {
    assert.equal(normalizeResendTags({ "...": "..." }), undefined);
  });
});

describe("isEmailDeliveryConfigured", () => {
  it("requires both API key and from address", () => {
    assert.equal(isEmailDeliveryConfigured({}), false);
    assert.equal(isEmailDeliveryConfigured({ RESEND_API_KEY: "re_x" }), false);
    assert.equal(isEmailDeliveryConfigured({ EMAIL_FROM: "a@b.com" }), false);
    assert.equal(
      isEmailDeliveryConfigured({ RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.com" }),
      true,
    );
  });
});
