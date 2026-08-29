import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validatePlanDraft } from "./plan-administration.js";

describe("plan administration validation", () => {
  it("accepts complete typed capabilities and normalized commercial terms", () => {
    assert.deepEqual(
      validatePlanDraft({
        billingInterval: "month",
        currency: "etb",
        features: { customDomains: false },
        limits: {},
        name: " Growth ",
        price: "1499.50",
      }),
      {
        billingInterval: "month",
        currency: "ETB",
        features: { customDomains: false },
        limits: {},
        name: "Growth",
        price: "1499.50",
        priceMinor: 149_950,
      },
    );
  });

  it("rejects missing, unknown, and incorrectly typed capabilities", () => {
    for (const features of [
      {},
      { customDomains: "yes" },
      { customDomains: false, unimplementedQuota: 20 },
    ]) {
      assert.equal(
        validatePlanDraft({
          billingInterval: "month",
          currency: "ETB",
          features,
          limits: {},
          name: "Growth",
          price: "1499",
        }),
        null,
      );
    }
  });

  it("accepts the enforced product limit and rejects unknown limits", () => {
    assert.deepEqual(
      validatePlanDraft({
        billingInterval: "month",
        currency: "ETB",
        features: { customDomains: false },
        limits: { products: 100 },
        name: "Growth",
        price: "1499",
      }),
      {
        billingInterval: "month",
        currency: "ETB",
        features: { customDomains: false },
        limits: { products: 100 },
        name: "Growth",
        price: "1499",
        priceMinor: 149_900,
      },
    );
    assert.equal(
      validatePlanDraft({
        billingInterval: "month",
        currency: "ETB",
        features: { customDomains: false },
        limits: { unimplementedQuota: 100 },
        name: "Growth",
        price: "1499",
      }),
      null,
    );
  });
});
