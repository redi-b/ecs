import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createResendEmailNotificationProvider,
  isEmailDeliveryConfigured,
} from "./email-provider.js";

describe("createResendEmailNotificationProvider", () => {
  it("sends via Resend API and returns a provider reference", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = createResendEmailNotificationProvider({
      apiKey: "re_test",
      from: "alerts@example.com",
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
    });

    assert.equal(result.providerReference, "resend:msg_123");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://api.resend.com/emails");
    const body = JSON.parse(String(calls[0]?.init.body));
    assert.equal(body.from, "alerts@example.com");
    assert.deepEqual(body.to, ["owner@shop.com"]);
    assert.equal(body.subject, "New order");
    assert.equal(body.text, "You have a new order.\nOrder: #10");
    assert.match(body.html, /<b>You have a new order\.<\/b>/);
    assert.match(body.html, /<br\/>/);
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
