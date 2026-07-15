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

  it("renders rich order.created messages", async () => {
    const result = await renderer.render({
      channel: "telegram",
      eventType: "order.created",
      tenantId: "tenant-1",
      recipient: "123",
      payload: {
        orderDisplayId: "10",
        amount: "10880.000000000000",
        currencyCode: "etb",
        customerName: "Abebe Kebede",
        customerPhone: "+251911000000",
        customerCity: "Addis Ababa",
        itemCount: 3,
        paymentMethod: "cod",
        deliveryChoice: "delivery",
      },
    });

    assert.match(result.body, /new order #10/i);
    assert.match(result.body, /ETB 10,880/);
    assert.match(result.body, /Customer: Abebe Kebede/);
    assert.match(result.body, /Phone: \+251911000000/);
    assert.match(result.body, /Items: 3 items/);
    assert.match(result.body, /Payment: Cash on delivery/);
    assert.match(result.body, /Fulfillment: Delivery/);
    assert.doesNotMatch(result.body, /10880\.000/);
  });

  it("renders cancelled and payment messages with details", async () => {
    const cancelled = await renderer.render({
      channel: "in_app",
      eventType: "order.cancelled",
      tenantId: "tenant-1",
      recipient: "in_app",
      payload: {
        orderDisplayId: "10",
        amount: "10880",
        currencyCode: "ETB",
        customerName: "Sara",
      },
    });
    assert.equal(cancelled.subject, "Order #10 cancelled");
    assert.match(cancelled.body, /Order #10 was cancelled/);
    assert.match(cancelled.body, /Customer: Sara/);

    const paid = await renderer.render({
      channel: "telegram",
      eventType: "payment.paid",
      tenantId: "tenant-1",
      recipient: "123",
      payload: {
        orderDisplayId: 10,
        amount: 10880,
        currencyCode: "ETB",
        source: "dashboard_mark_paid",
        paymentMethod: "cod",
      },
    });
    assert.match(paid.body, /Payment received for order #10/);
    assert.match(paid.body, /Amount: ETB 10,880/);
    assert.match(paid.body, /Marked paid in dashboard/);
  });

  it("renders recipient-facing test notifications without restating destination", async () => {
    const result = await renderer.render({
      channel: "telegram",
      eventType: "notification.test",
      tenantId: "tenant-1",
      recipient: "123",
      payload: {
        shopName: "Bole Stylee",
        destinationLabel: "@owner_bot",
        sentAt: "2026-07-15T11:27:00.000Z",
      },
    });

    assert.match(result.body, /Bole Stylee.*Telegram alerts are working/i);
    assert.match(result.body, /Delivery succeeded/);
    assert.match(result.body, /Settings > Notifications/);
    // Recipient already received the message; do not echo their handle/email.
    assert.doesNotMatch(result.body, /@owner_bot/);
    assert.doesNotMatch(result.body, /Sent to/i);
    assert.doesNotMatch(result.body, /—/);
    assert.ok(result.html?.includes("<b>"));
    assert.match(result.html ?? "", /Bole Stylee/);
  });

  it("uses subject for in-app titles", async () => {
    const result = await renderer.render({
      channel: "in_app",
      eventType: "payment.paid",
      tenantId: "tenant-1",
      recipient: "in_app",
      payload: { orderDisplayId: "10", amount: "10880", currencyCode: "etb" },
    });
    assert.equal(result.subject, "Payment received for #10");
  });
});
