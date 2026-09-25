import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BILLING_RENEWAL_LEAD_DAYS,
  addBillingInterval,
  encodeScheduledDowngrade,
  planBillingLifecycle,
} from "./lifecycle.js";

describe("billing period arithmetic", () => {
  it("supports every published interval", () => {
    const start = new Date("2026-01-15T12:30:00.000Z");
    assert.equal(addBillingInterval(start, "day").toISOString(), "2026-01-16T12:30:00.000Z");
    assert.equal(addBillingInterval(start, "week").toISOString(), "2026-01-22T12:30:00.000Z");
    assert.equal(addBillingInterval(start, "month").toISOString(), "2026-02-15T12:30:00.000Z");
    assert.equal(addBillingInterval(start, "year").toISOString(), "2027-01-15T12:30:00.000Z");
  });

  it("clamps month and year boundaries instead of overflowing", () => {
    assert.equal(
      addBillingInterval(new Date("2026-01-31T00:00:00.000Z"), "month").toISOString(),
      "2026-02-28T00:00:00.000Z",
    );
    assert.equal(
      addBillingInterval(new Date("2024-02-29T00:00:00.000Z"), "year").toISOString(),
      "2025-02-28T00:00:00.000Z",
    );
  });
});

describe("billing lifecycle policy", () => {
  const periodEnd = new Date("2026-09-01T00:00:00.000Z");

  it("opens renewal at the one-week boundary and marks expiry past due", () => {
    assert.equal(BILLING_RENEWAL_LEAD_DAYS, 7);
    assert.equal(
      planBillingLifecycle({
        currentPeriodEnd: periodEnd,
        manualPaymentState: "paid",
        now: new Date("2026-08-24T23:59:59.999Z"),
        status: "active",
      }).createRenewalInvoice,
      false,
    );
    const ended = planBillingLifecycle({
      currentPeriodEnd: periodEnd,
      manualPaymentState: "paid",
      now: periodEnd,
      status: "active",
    });
    assert.equal(ended.createRenewalInvoice, true);
    assert.equal(ended.markPastDue, true);
  });

  it("expires trials without renewal and applies downgrades only at period end", () => {
    const trial = planBillingLifecycle({
      currentPeriodEnd: periodEnd,
      manualPaymentState: "trial",
      now: periodEnd,
      status: "trialing",
    });
    assert.equal(trial.expireTrial, true);
    assert.equal(trial.createRenewalInvoice, false);

    const manualPaymentState = encodeScheduledDowngrade("starter-plan");
    assert.equal(
      planBillingLifecycle({
        currentPeriodEnd: periodEnd,
        manualPaymentState,
        now: new Date("2026-08-31T23:59:59.999Z"),
        status: "active",
      }).applyScheduledDowngrade,
      false,
    );
    const downgrade = planBillingLifecycle({
      currentPeriodEnd: periodEnd,
      manualPaymentState,
      now: periodEnd,
      status: "active",
    });
    assert.equal(downgrade.applyScheduledDowngrade, true);
    assert.equal(downgrade.scheduledPlanId, "starter-plan");
  });
});
