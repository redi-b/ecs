import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { merchantExpenseInputSchema } from "@ecs/contracts";
import { calculateEstimatedProfit, summarizeEstimatedProfit } from "./merchant-expenses.js";

describe("merchant expense contract", () => {
  it("keeps ETB money in integer minor units and rejects zero/negative values", () => {
    const input = {
      amount: 12_550,
      category: "delivery_transport",
      currencyCode: "ETB",
      occurredOn: "2026-09-29",
    };
    assert.equal(merchantExpenseInputSchema.parse(input).currencyCode, "etb");
    assert.equal(merchantExpenseInputSchema.safeParse({ ...input, amount: 0 }).success, false);
    assert.equal(merchantExpenseInputSchema.safeParse({ ...input, amount: 12.5 }).success, false);
  });

  it("labels missing product cost as partial coverage instead of treating it as zero certainty", () => {
    assert.deepEqual(
      calculateEstimatedProfit({
        expenses: 2_000,
        knownProductCost: 3_000,
        recordedRefunds: 500,
        recognizedSales: 10_000,
        ordersMissingCost: 2,
      }),
      {
        amount: 4_500,
        coverage: "partial",
        expenses: 2_000,
        knownProductCost: 3_000,
        recordedRefunds: 500,
        recognizedSales: 10_000,
        ordersMissingCost: 2,
      },
    );
  });

  it("uses paid Medusa orders, recorded refunds, immutable line costs, and active expenses", () => {
    assert.deepEqual(
      summarizeEstimatedProfit({
        expenses: 1_000,
        orders: [
          {
            id: "order_paid",
            currencyCode: "etb",
            paymentStatus: "partially_refunded",
            refundedTotal: 500,
            status: "pending",
            total: 10_000,
          },
          {
            id: "order_unpaid",
            currencyCode: "etb",
            paymentStatus: "not_paid",
            refundedTotal: 0,
            status: "pending",
            total: 9_000,
          },
        ],
        snapshots: [
          { orderId: "order_paid", quantity: 2, unitCostAmount: 2_000 },
          { orderId: "order_paid", quantity: 1, unitCostAmount: null },
        ],
      }),
      {
        amount: 4_500,
        coverage: "partial",
        excludedOrders: 1,
        expenses: 1_000,
        knownProductCost: 4_000,
        ordersMissingCost: 1,
        recognizedOrders: 1,
        recognizedSales: 10_000,
        recordedRefunds: 500,
      },
    );
  });
});
