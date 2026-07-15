import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BILLING_CHAPA_TX_PREFIX,
  billingTxRefForInvoice,
  isPlatformBillingTxRef,
} from "./service.js";

describe("platform billing Chapa tx refs", () => {
  it("prefixes platform billing refs and rejects commerce-like refs", () => {
    const tx = billingTxRefForInvoice("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    assert.ok(tx.startsWith(BILLING_CHAPA_TX_PREFIX));
    assert.ok(isPlatformBillingTxRef(tx));
    assert.equal(isPlatformBillingTxRef("chapa_order_123"), false);
    assert.equal(isPlatformBillingTxRef("ecs_bill_abc"), true);
  });
});
