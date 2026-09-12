import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCustomerOrderEmail,
  formatOrderTotal,
  isDeliverableCustomerEmail,
} from "./customer-order-dispatcher.js";

describe("customer order email dispatcher", () => {
  it("maps each customer order lifecycle event to a dedicated durable template", () => {
    const expected = {
      "order.cancelled": "customer.order_cancelled",
      "order.created": "customer.order_confirmation",
      "order.delivered": "customer.order_delivered",
      "order.out_for_delivery": "customer.order_out_for_delivery",
      "order.ready": "customer.order_ready",
    } as const;

    for (const [eventType, templateKey] of Object.entries(expected)) {
      const result = buildCustomerOrderEmail({
        eventId: "event-1",
        eventType,
        payload: {
          amount: "1850",
          currencyCode: "etb",
          customerEmail: "LIYA@example.com",
          customerName: "Liya",
          orderId: "order_1",
          publicOrderReference: "ECS-1042",
          sourceEventId: `${eventType}:order_1`,
        },
        tenantId: "tenant-1",
        tenantName: "Bole Style",
      });

      assert.ok("email" in result);
      assert.equal(result.email.templateKey, templateKey);
      assert.equal(result.email.recipient, "LIYA@example.com");
      assert.equal(result.email.idempotencySource, `${eventType}:v1:${eventType}:order_1`);
      assert.deepEqual(result.email.variables, {
        order_reference: "ECS-1042",
        order_total: "ETB 1,850",
        recipient_name: "Liya",
        shop_name: "Bole Style",
      });
    }
  });

  it("does not send customer mail for merchant-only events or placeholder addresses", () => {
    assert.deepEqual(
      buildCustomerOrderEmail({
        eventId: "event-1",
        eventType: "inventory.low",
        payload: {},
        tenantId: "tenant-1",
        tenantName: "Bole Style",
      }),
      { skipped: "event_not_customer_email" },
    );
    assert.equal(isDeliverableCustomerEmail("walk-in@orders.local"), false);
    assert.equal(isDeliverableCustomerEmail("real.customer@example.com"), true);
  });

  it("formats ETB totals without adding fake precision", () => {
    assert.equal(formatOrderTotal({ amount: 1850, currencyCode: "ETB" }), "ETB 1,850");
  });

  it("never exposes an internal Medusa order id when an older event has no public reference", () => {
    const result = buildCustomerOrderEmail({
      eventId: "event-1",
      eventType: "order.created",
      payload: {
        customerEmail: "liya@example.com",
        orderId: "order_01KXE59NRXJY6H5P2T4F0H3FR2",
      },
      tenantId: "tenant-1",
      tenantName: "Bole Style",
    });

    assert.ok("email" in result);
    assert.equal(result.email.variables.order_reference, "ORD-2T4F0H3FR2");
  });
});
