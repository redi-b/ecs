import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantOrder } from "@ecs/contracts";

import {
  formatOrderReference,
  getNextAction,
  getOrderProgress,
  getOrderWorkflowStage,
  getPaymentLabel,
  getRemainingFinishSteps,
} from "./order-domain";

function order(partial: Partial<MerchantOrder>): MerchantOrder {
  return {
    id: "order_01ABCDEF",
    displayId: 12,
    email: "a@example.com",
    status: "pending",
    paymentStatus: "not_paid",
    fulfillmentStatus: "not_fulfilled",
    currencyCode: "etb",
    total: 100,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...partial,
  };
}

function delivery(choice: string) {
  return { choice, customerName: null, customerPhone: null, landmark: null, notes: null };
}

describe("order-domain", () => {
  it("formats short order references", () => {
    assert.equal(formatOrderReference(order({ id: "order_01ABCDEF" })), "ORD-01ABCDEF");
    assert.equal(
      formatOrderReference(order({ customDisplayId: "BOLE-1042" })),
      "BOLE-1042",
    );
  });

  it("maps progress and next actions", () => {
    assert.equal(getOrderProgress(order({})), "new");
    assert.equal(getNextAction(order({})).type, "mark_ready");

    const ready = order({ fulfillmentStatus: "fulfilled" });
    assert.equal(getOrderProgress(ready), "ready");
    assert.equal(getNextAction(ready).type, "mark_completed");

    const completed = order({ status: "completed", fulfillmentStatus: "delivered" });
    assert.equal(getOrderProgress(completed), "completed");
    assert.equal(getNextAction(completed).type, "none");

    const paidDone = order({
      status: "completed",
      fulfillmentStatus: "delivered",
      paymentStatus: "captured",
      paymentMethod: "cod",
    });
    assert.equal(getNextAction(paidDone).type, "none");
  });

  it("uses simple delivery and pickup workflows", () => {
    const deliveryOrder = order({ delivery: delivery("delivery") });
    assert.equal(getOrderWorkflowStage(deliveryOrder), "new");
    assert.equal(getNextAction(deliveryOrder).type, "mark_out_for_delivery");

    const fulfilled = order({
      delivery: delivery("delivery"),
      fulfillmentStatus: "fulfilled",
    });
    assert.equal(getOrderWorkflowStage(fulfilled), "new");
    assert.equal(getNextAction(fulfilled).type, "mark_out_for_delivery");

    const shipping = order({
      delivery: delivery("delivery"),
      fulfillmentStatus: "shipped",
    });
    assert.equal(getOrderWorkflowStage(shipping), "out_for_delivery");
    assert.equal(getNextAction(shipping).type, "mark_delivered");

    const pickup = order({ delivery: delivery("pickup") });
    assert.equal(getNextAction(pickup).type, "mark_ready_for_pickup");
    const pickupReady = order({ delivery: delivery("pickup"), fulfillmentStatus: "fulfilled" });
    assert.equal(getOrderWorkflowStage(pickupReady), "ready_for_pickup");
    assert.equal(getNextAction(pickupReady).type, "mark_picked_up");
  });

  it("lists finish steps for open COD orders", () => {
    const steps = getRemainingFinishSteps(order({ paymentMethod: "cod" }), {
      includeMarkPaid: true,
    });
    assert.ok(steps.some((step) => step.id === "ready"));
    assert.ok(steps.some((step) => step.id === "completed"));
    assert.ok(steps.some((step) => step.id === "paid"));
  });

  it("classifies payment labels", () => {
    assert.equal(getPaymentLabel(order({ paymentStatus: "awaiting" })), "unpaid");
    assert.equal(getPaymentLabel(order({ paymentStatus: "captured" })), "paid");
  });
});
