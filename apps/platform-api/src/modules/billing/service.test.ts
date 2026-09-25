import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BILLING_CHAPA_TX_PREFIX,
  billingTxRefForInvoice,
  isPlatformBillingTxRef,
} from "./service.js";
import { getDefaultPlanPresentation } from "./plan-catalog.js";

describe("default public plan presentations", () => {
  it("provides landing copy only for built-in public plans", () => {
    assert.equal(getDefaultPlanPresentation("starter")?.publicName, "Starter");
    assert.equal(getDefaultPlanPresentation("growth")?.featured, true);
    assert.equal(getDefaultPlanPresentation("operator-only"), null);
  });
});

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
