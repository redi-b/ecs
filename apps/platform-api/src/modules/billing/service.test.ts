import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BILLING_CHAPA_TX_PREFIX,
  BILLING_RENEWAL_LEAD_DAYS,
  billingTxRefForInvoice,
  encodeScheduledDowngrade,
  isPlatformBillingTxRef,
  planBillingLifecycle,
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

describe("billing lifecycle time boundaries", () => {
  const periodEnd = new Date("2026-09-01T00:00:00.000Z");

  it("does nothing before the seven-day renewal window", () => {
    assert.deepEqual(
      planBillingLifecycle({
        currentPeriodEnd: periodEnd,
        manualPaymentState: "paid",
        now: new Date("2026-08-24T23:59:59.999Z"),
        status: "active",
      }),
      {
        applyScheduledDowngrade: false,
        createRenewalInvoice: false,
        markPastDue: false,
        scheduledPlanId: null,
      },
    );
  });

  it("opens renewal exactly at the lead boundary and marks past due at expiry", () => {
    assert.equal(
      planBillingLifecycle({
        currentPeriodEnd: periodEnd,
        manualPaymentState: "paid",
        now: new Date("2026-08-25T00:00:00.000Z"),
        status: "active",
      }).createRenewalInvoice,
      true,
    );
    const expired = planBillingLifecycle({
      currentPeriodEnd: periodEnd,
      manualPaymentState: "paid",
      now: periodEnd,
      status: "active",
    });
    assert.equal(expired.createRenewalInvoice, true);
    assert.equal(expired.markPastDue, true);
  });

  it("suppresses renewal and past-due while a downgrade waits, then applies it at expiry", () => {
    const manualPaymentState = encodeScheduledDowngrade("starter_plan");
    const waiting = planBillingLifecycle({
      currentPeriodEnd: periodEnd,
      manualPaymentState,
      now: new Date("2026-08-31T23:59:59.999Z"),
      status: "active",
    });
    assert.equal(waiting.createRenewalInvoice, false);
    assert.equal(waiting.markPastDue, false);
    assert.equal(waiting.applyScheduledDowngrade, false);

    const ended = planBillingLifecycle({
      currentPeriodEnd: periodEnd,
      manualPaymentState,
      now: periodEnd,
      status: "active",
    });
    assert.equal(ended.applyScheduledDowngrade, true);
    assert.equal(ended.scheduledPlanId, "starter_plan");
  });
});
