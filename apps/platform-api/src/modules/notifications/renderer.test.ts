import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createCodeNotificationRenderer,
  formatMoneyAmount,
  formatOrderRef,
} from "./renderer.js";

describe("formatOrderRef", () => {
  it("prefixes numeric display ids", () => {
    assert.equal(formatOrderRef("10"), "#10");
    assert.equal(formatOrderRef("#10"), "#10");
  });

  it("hides long medusa order ids", () => {
    assert.equal(formatOrderRef("order_01KXE59NRXJY6H5P2T4F0H3FR2"), "order");
  });
});

describe("formatMoneyAmount", () => {
  it("strips float noise and adds currency", () => {
    assert.equal(formatMoneyAmount("10880.000000000000", "etb"), "ETB 10,880");
    assert.equal(formatMoneyAmount("1200.5", "ETB"), "ETB 1,200.5");
    assert.equal(formatMoneyAmount("99", undefined), "99");
  });

  it("leaves already-labeled amounts alone", () => {
    assert.equal(formatMoneyAmount("ETB 1200", "etb"), "ETB 1200");
  });
});

describe("createCodeNotificationRenderer", () => {
  const renderer = createCodeNotificationRenderer();

  it("renders order.created with subject for email", async () => {
    const result = await renderer.render({
      channel: "email",
      eventType: "order.created",
      tenantId: "tenant-1",
      recipient: "owner@example.com",
      payload: { orderDisplayId: "1001", amount: "1200", currencyCode: "etb" },
    });

    assert.equal(result.subject, "New order #1001");
    assert.match(result.body, /#1001/);
    assert.match(result.body, /ETB 1,200/);
    assert.doesNotMatch(result.body, /Channel:/i);
  });

  it("renders cancelled and payment messages cleanly for telegram", async () => {
    const cancelled = await renderer.render({
      channel: "telegram",
      eventType: "order.cancelled",
      tenantId: "tenant-1",
      recipient: "12345",
      payload: { orderDisplayId: "10", amount: "10880.000000000000", currencyCode: "etb" },
    });
    assert.equal(cancelled.subject, undefined);
    assert.match(cancelled.body, /Order #10 was cancelled/);
    assert.match(cancelled.body, /ETB 10,880/);
    assert.doesNotMatch(cancelled.body, /000000/);

    const paid = await renderer.render({
      channel: "telegram",
      eventType: "payment.paid",
      tenantId: "tenant-1",
      recipient: "12345",
      payload: { orderDisplayId: 10, amount: 10880, currencyCode: "ETB" },
    });
    assert.match(paid.body, /Payment received for order #10/);
    assert.match(paid.body, /ETB 10,880/);
  });

  it("omits channel jargon from test messages", async () => {
    const result = await renderer.render({
      channel: "telegram",
      eventType: "notification.test",
      tenantId: "tenant-1",
      recipient: "12345",
      payload: {},
    });

    assert.equal(result.subject, undefined);
    assert.match(result.body, /test alert/i);
    assert.doesNotMatch(result.body, /Channel:\s*telegram/i);
  });

  it("uses subject for in-app titles", async () => {
    const result = await renderer.render({
      channel: "in_app",
      eventType: "payment.paid",
      tenantId: "tenant-1",
      recipient: "in_app",
      payload: { orderDisplayId: "10", amount: "10880", currencyCode: "etb" },
    });
    assert.equal(result.subject, "Payment received · #10");
  });
});
