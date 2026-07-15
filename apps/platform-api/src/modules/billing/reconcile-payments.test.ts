import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reconcileChapaBillingPayments } from "./reconcile-payments.js";

describe("reconcileChapaBillingPayments", () => {
  it("applies only successful Chapa verifications", async () => {
    const completed: string[] = [];
    const result = await reconcileChapaBillingPayments({
      items: [
        { invoiceId: "inv_1", tenantId: "t1", txRef: "ecs_bill_a_1" },
        { invoiceId: "inv_2", tenantId: "t1", txRef: "ecs_bill_a_2" },
        { invoiceId: "inv_3", tenantId: "t2", txRef: "ecs_bill_b_1" },
      ],
      verifyPayment: async (txRef) => {
        if (txRef === "ecs_bill_a_2") {
          return { data: { status: "pending" } };
        }
        if (txRef === "ecs_bill_b_1") {
          throw new Error("network");
        }
        return { data: { status: "success", ref_id: "chapa_1" } };
      },
      completePayment: async (input) => {
        completed.push(input.txRef);
        return { ok: true, applied: true };
      },
    });

    assert.deepEqual(completed, ["ecs_bill_a_1"]);
    assert.deepEqual(result, { checked: 3, confirmed: 1, errors: 1 });
  });

  it("does not count already-applied payments as confirmed", async () => {
    const result = await reconcileChapaBillingPayments({
      items: [{ invoiceId: "inv_1", tenantId: "t1", txRef: "ecs_bill_x" }],
      verifyPayment: async () => ({ data: { status: "success" } }),
      completePayment: async () => ({ ok: true, applied: false }),
    });

    assert.deepEqual(result, { checked: 1, confirmed: 0, errors: 0 });
  });
});
