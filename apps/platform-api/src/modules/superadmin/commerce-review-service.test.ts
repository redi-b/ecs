import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSuperadminCommerceReviewService } from "./commerce-review-service.js";

describe("superadmin commerce review", () => {
  it("projects safe billing and payment-review evidence", async () => {
    const service = createSuperadminCommerceReviewService({
      getBillingStatus: async () => ({
        ok: true,
        billing: {
          plan: {
            id: "plan_1",
            name: "Growth",
            price: "1200",
            limits: {},
            features: {},
            isFree: false,
          },
          subscription: {
            id: "subscription_1",
            status: "active",
            billingCycle: "monthly",
            manualPaymentState: "pending",
            currentPeriodStart: "2026-08-01T00:00:00.000Z",
            currentPeriodEnd: "2026-09-01T00:00:00.000Z",
          },
          invoices: [
            {
              id: "invoice_1",
              amount: "1200.00",
              currency: "ETB",
              status: "pending",
              dueAt: "2026-08-31T00:00:00.000Z",
              paidAt: null,
              provider: null,
              providerReference: null,
              createdAt: "2026-08-01T00:00:00.000Z",
            },
          ],
          availablePaidPlans: [],
          catalog: [],
        },
      }),
      listPaymentOnboarding: async () => ({
        ok: true,
        paymentOnboarding: [
          {
            id: "payment_1",
            provider: "chapa",
            status: "pending_review",
            requiredDocuments: ["business_license", { secret: true }],
            notes: "Ready for review",
            providerAccountRef: null,
          },
        ],
      }),
    });

    const result = await service({
      includeBilling: true,
      includePayments: true,
      tenantId: "tenant_1",
    });

    assert.equal(result.billing?.planName, "Growth");
    assert.equal(result.billing?.invoices[0]?.id, "invoice_1");
    assert.deepEqual(result.paymentOnboarding?.[0]?.requiredDocuments, ["business_license"]);
    assert.equal(JSON.stringify(result).includes("secret"), false);
  });

  it("does not read or return a section without its permission", async () => {
    let paymentsRead = false;
    const service = createSuperadminCommerceReviewService({
      getBillingStatus: async () => ({ ok: false, error: "billing_not_found" }),
      listPaymentOnboarding: async () => {
        paymentsRead = true;
        return { ok: true, paymentOnboarding: [] };
      },
    });

    const result = await service({
      includeBilling: true,
      includePayments: false,
      tenantId: "tenant_1",
    });

    assert.equal(paymentsRead, false);
    assert.equal(result.paymentOnboarding, null);
  });
});
