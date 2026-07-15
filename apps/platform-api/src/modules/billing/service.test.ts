import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BILLING_CHAPA_TX_PREFIX,
  BILLING_RENEWAL_LEAD_DAYS,
  billingTxRefForInvoice,
  isPlatformBillingTxRef,
} from "./service.js";

describe("platform billing Chapa tx refs", () => {
  it("prefixes platform billing refs and rejects commerce-like refs", () => {
    const invoiceId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const a = billingTxRefForInvoice(invoiceId);
    const b = billingTxRefForInvoice(invoiceId);
    assert.ok(a.startsWith(BILLING_CHAPA_TX_PREFIX));
    assert.ok(isPlatformBillingTxRef(a));
    // Each pay attempt must mint a unique ref (Chapa rejects reuse).
    assert.notEqual(a, b);
    assert.equal(isPlatformBillingTxRef("chapa_order_123"), false);
    assert.equal(isPlatformBillingTxRef("ecs_bill_abc"), true);
  });
});

describe("billing renewal constants", () => {
  it("uses a one-week lead window for renewals", () => {
    assert.equal(BILLING_RENEWAL_LEAD_DAYS, 7);
  });
});
