import assert from "node:assert/strict";
import test from "node:test";

import ChapaPaymentProviderService from "./service.js";

test("records merchant-confirmed manual Chapa refunds without calling Chapa", async () => {
  const provider = new ChapaPaymentProviderService({}, {});
  const result = await provider.refundPayment({
    amount: 250,
    data: { tx_ref: "ecs_order_1" },
  });

  assert.equal(result.data?.tx_ref, "ecs_order_1");
  assert.equal(
    (result.data?.last_manual_refund as { amount?: string } | undefined)?.amount,
    "250.00",
  );
});
