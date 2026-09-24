import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCodeNotificationRenderer, formatMoneyAmount, formatOrderRef } from "./renderer.js";

describe("formatOrderRef", () => {
  it("prefixes numeric display ids for legacy payloads", () => {
    assert.equal(formatOrderRef("10"), "#10");
    assert.equal(formatOrderRef("#10"), "#10");
  });

  it("turns medusa order ids into shared public references", () => {
    assert.equal(formatOrderRef("order_01KXE59NRXJY6H5P2T4F0H3FR2"), "ORD-2T4F0H3FR2");
  });

  it("keeps short alphanumeric codes", () => {
    assert.equal(formatOrderRef("ab12cd"), "AB12CD");
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
        orderId: "order_01KXE59NRXJY6H5P2T4F0H3FR2",
        amount: "10880.000000000000",
        currencyCode: "etb",
        customerName: "Abebe Kebede",
        customerPhone: "+251911000000",
        customerCity: "Addis Ababa",
        itemCount: 3,
        itemLines: ["Linen Midi Dress · M / Sage × 1", "Denim Jacket · M × 2"],
        paymentMethod: "cod",
        deliveryChoice: "delivery",
        paymentReference: "CHAPA-ugly-tx-ref-should-not-appear",
      },
    });

    assert.match(result.body, /new order ORD-2T4F0H3FR2/i);
    assert.match(result.body, /ETB 10,880/);
    assert.match(result.body, /Customer: Abebe Kebede/);
    assert.match(result.body, /Phone: \+251911000000/);
    assert.match(result.body, /Linen Midi Dress · M \/ Sage/);
    assert.match(result.body, /Denim Jacket · M/);
    assert.match(result.body, /Payment: Pay in person/);
    assert.match(result.body, /Fulfillment: Delivery/);
    assert.doesNotMatch(result.body, /COD/i);
    assert.doesNotMatch(result.body, /10880\.000/);
    assert.doesNotMatch(result.body, /CHAPA-ugly/i);
    assert.doesNotMatch(result.body, /Reference:/i);
  });

  it("hides synthetic emails and placeholder customer names", async () => {
    const result = await renderer.render({
      channel: "telegram",
      eventType: "order.created",
      tenantId: "tenant-1",
      recipient: "123",
      payload: {
        orderId: "order_01TESTSYNTHETICMAIL1",
        amount: "100",
        currencyCode: "ETB",
        customerName: "Customer",
        customerEmail: "telegram+0987654321@orders.local",
        customerPhone: "0911000000",
        paymentMethod: "cod",
      },
    });
    assert.doesNotMatch(result.body, /Customer: Customer/);
    assert.doesNotMatch(result.body, /@orders\.local/);
    assert.doesNotMatch(result.body, /COD/i);
    assert.match(result.body, /Phone: 0911000000/);
    assert.match(result.body, /Pay in person/);
  });

  it("renders cancelled and payment messages with details", async () => {
    const cancelled = await renderer.render({
      channel: "in_app",
      eventType: "order.cancelled",
      tenantId: "tenant-1",
      recipient: "in_app",
      payload: {
        orderId: "order_01TESTCANCELCODE99",
        amount: "10880",
        currencyCode: "ETB",
        customerName: "Sara",
      },
    });
    assert.equal(cancelled.subject, "Order ORD-NCELCODE99 cancelled");
    assert.match(cancelled.body, /Order ORD-NCELCODE99 was cancelled/);
    assert.match(cancelled.body, /Customer: Sara/);

    const paid = await renderer.render({
      channel: "telegram",
      eventType: "payment.paid",
      tenantId: "tenant-1",
      recipient: "123",
      payload: {
        orderId: "order_01TESTPAYMENTPAID1",
        amount: 10880,
        currencyCode: "ETB",
        source: "dashboard_mark_paid",
        paymentMethod: "cod",
        txRef: "ecs_pay_should_not_show",
      },
    });
    assert.match(paid.body, /Payment received for order ORD-YMENTPAID1/i);
    assert.match(paid.body, /Amount: ETB 10,880/);
    assert.match(paid.body, /Marked paid in dashboard/);
    assert.doesNotMatch(paid.body, /ecs_pay/i);
  });

  it("renders each fulfillment transition with distinct copy", async () => {
    const base = {
      channel: "in_app" as const,
      tenantId: "tenant-1",
      recipient: "in_app",
      payload: {
        orderId: "order_01TESTFULFILLMENT1",
        deliveryChoice: "delivery",
      },
    };
    const ready = await renderer.render({ ...base, eventType: "order.ready" });
    const shipped = await renderer.render({ ...base, eventType: "order.out_for_delivery" });
    const delivered = await renderer.render({ ...base, eventType: "order.delivered" });

    assert.match(ready.subject ?? "", /prepared/i);
    assert.match(shipped.subject ?? "", /out for delivery/i);
    assert.match(delivered.subject ?? "", /delivered/i);
    assert.notEqual(ready.body, shipped.body);
    assert.notEqual(shipped.body, delivered.body);
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
      payload: {
        orderId: "order_01ABCDEFGHJKLMN",
        amount: "10880",
        currencyCode: "etb",
      },
    });
    assert.equal(result.subject, "Payment received for ORD-DEFGHJKLMN");
  });

  it("renders actionable storefront inquiry notifications", async () => {
    const result = await renderer.render({
      channel: "telegram",
      eventType: "storefront.inquiry_created",
      tenantId: "tenant-1",
      recipient: "123",
      payload: {
        inquiryId: "inquiry_1",
        type: "product_request",
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        subject: "Product request: Vitamin C serum",
      },
    });
    assert.match(result.body, /Jane Doe sent a new storefront inquiry/);
    assert.match(result.body, /Product request/);
    assert.match(result.body, /Open Inquiries in your dashboard/);
  });

  it("renders renewal reminders in simple merchant-facing language", async () => {
    const result = await renderer.render({
      channel: "telegram",
      eventType: "billing.invoice_ready",
      tenantId: "tenant-1",
      recipient: "123",
      payload: {
        amount: "1000",
        currencyCode: "ETB",
        daysRemaining: 3,
        planName: "Growth",
      },
    });

    assert.match(result.body, /due in 3 days/i);
    assert.match(result.body, /ETB 1,000/);
    assert.doesNotMatch(result.body, /invoice_ready|worker|lifecycle/i);
  });

  it("renders a rejected plan payment with the operator's correction note", async () => {
    const result = await renderer.render({
      channel: "email",
      eventType: "billing.payment_rejected",
      tenantId: "tenant-1",
      recipient: "owner@example.com",
      payload: {
        amount: "2499",
        currencyCode: "ETB",
        invoiceId: "invoice-1",
        reason: "The receipt amount does not match this invoice.",
      },
    });
    assert.match(result.body, /could not confirm/i);
    assert.match(result.body, /ETB 2,499/);
    assert.match(result.body, /receipt amount does not match/i);
    assert.match(result.body, /Open Billing/i);
  });

  it("renders operational events with specific actions instead of the generic fallback", async () => {
    for (const eventType of [
      "chapa.onboarding_needs_review",
      "domain.misconfigured",
      "payment.webhook_failed",
      "shop.provisioning_failed",
      "shop.published",
      "shop.suspended",
    ]) {
      const result = await renderer.render({
        channel: "in_app",
        eventType,
        tenantId: "tenant-1",
        recipient: "in_app",
        payload: { hostname: "shop.example.com", reason: "verification_failed", txRef: "tx-1" },
      });
      assert.doesNotMatch(result.body, /Something updated in your shop/i, eventType);
      assert.ok(result.subject, `${eventType} should provide an inbox title`);
    }
  });
});
