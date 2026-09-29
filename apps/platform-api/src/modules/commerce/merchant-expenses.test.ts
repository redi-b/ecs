import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { merchantExpenseInputSchema } from "@ecs/contracts";
import { calculateEstimatedProfit } from "./merchant-expenses.js";

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
});
