import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantOrder } from "@ecs/contracts";

import {
  formatOrderReference,
  getNextAction,
  getOrderProgress,
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

describe("order-domain", () => {
  it("formats short order references", () => {
    assert.equal(formatOrderReference(order({ id: "order_01ABCDEF" })), "ABCDEF");
  });

  it("maps progress and next actions", () => {
    assert.equal(getOrderProgress(order({})), "new");
    assert.equal(getNextAction(order({})).type, "mark_ready");

    const ready = order({ fulfillmentStatus: "fulfilled" });
    assert.equal(getOrderProgress(ready), "ready");
    assert.equal(getNextAction(ready).type, "mark_completed");

    const completed = order({ status: "completed", fulfillmentStatus: "delivered" });
    assert.equal(getOrderProgress(completed), "completed");
    assert.equal(getNextAction(completed).type, "mark_paid");

    const paidDone = order({
      status: "completed",
      fulfillmentStatus: "delivered",
      paymentStatus: "captured",
      paymentMethod: "cod",
    });
    assert.equal(getNextAction(paidDone).type, "none");
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
