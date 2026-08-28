import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSuperadminOperationalSummaryService } from "./operational-summary-service.js";

describe("superadmin operational summary", () => {
  it("projects operational state without provider references, challenges, or commerce IDs", async () => {
    const getSummary = createSuperadminOperationalSummaryService({
      getBillingStatus: async () =>
        ({
          ok: true,
          billing: {
            subscription: { status: "active" },
            plan: { name: "Growth" },
            invoices: [
              { status: "pending", providerReference: "secret-provider-ref" },
              { status: "paid" },
            ],
          },
        }) as never,
      getTenantReadiness: async () =>
        ({
          ok: true,
          readiness: {
            ready: false,
            missing: ["storefront_not_published"],
            checks: {
              tenant: { ready: true },
              domain: { ready: true },
              commerce: { ready: true },
              storefront: { ready: false, hasDraft: true, isPublished: false },
              provisioning: {
                ready: true,
                latestAttempt: { error: "internal stack and provider token" },
              },
            },
          },
        }) as never,
      listPaymentOnboarding: async () =>
        ({
          ok: true,
          paymentOnboarding: [
            { status: "pending_review", providerAccountRef: "secret-account-ref" },
            { status: "approved", providerAccountRef: "another-secret" },
          ],
        }) as never,
      listTenantDomains: async () =>
        ({
          ok: true,
          domains: [
            {
              hostname: "merchant.ecs.example",
              type: "platform_subdomain",
              status: "active",
              isPrimary: true,
            },
            {
              hostname: "shop.example.com",
              type: "custom_domain",
              status: "pending_verification",
              isPrimary: false,
              verificationChallenge: { recordValue: "secret-dns-token" },
            },
          ],
        }) as never,
    });

    const result = await getSummary({ tenantId: "tenant_1" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.summary.billing.pendingInvoiceCount, 1);
    assert.equal(result.summary.domains.pending, 1);
    assert.equal(result.summary.payments.approved, 1);
    const serialized = JSON.stringify(result.summary);
    assert.doesNotMatch(serialized, /secret|providerReference|verificationChallenge|latestAttempt/);
  });
});
