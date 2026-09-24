import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBillingPaymentVerificationChain } from "./payment-verification.js";

const input = {
  approvedRecipients: [{ accountName: "ECS PLC", accountNumber: "251911223344" }],
  amount: "1000",
  currency: "ETB",
  invoiceId: "invoice-1",
  issuedAt: new Date("2026-09-01T00:00:00.000Z"),
  provider: "telebirr",
  reference: "ABC123",
  tenantId: "tenant-1",
};

describe("billing payment verification chain", () => {
  it("falls through inconclusive adapters and accepts the next definitive result", async () => {
    const verify = createBillingPaymentVerificationChain([
      {
        id: "direct",
        supports: () => true,
        verify: async () => ({ decision: "inconclusive" as const }),
      },
      {
        id: "fallback",
        supports: () => true,
        verify: async () => ({
          decision: "verified" as const,
          providerReference: "canonical-123",
          source: "fallback",
        }),
      },
    ]);

    assert.deepEqual(await verify(input), {
      decision: "verified",
      providerReference: "canonical-123",
      source: "fallback",
    });
  });

  it("does not let a fallback override a definitive rejection", async () => {
    let fallbackCalled = false;
    const verify = createBillingPaymentVerificationChain([
      {
        id: "direct",
        supports: () => true,
        verify: async () => ({ decision: "rejected" as const, source: "direct" }),
      },
      {
        id: "fallback",
        supports: () => true,
        verify: async () => {
          fallbackCalled = true;
          return { decision: "verified" as const, source: "fallback" };
        },
      },
    ]);

    assert.deepEqual(await verify(input), { decision: "rejected", source: "direct" });
    assert.equal(fallbackCalled, false);
  });

  it("routes unsupported or inconclusive payments to manual review", async () => {
    const verify = createBillingPaymentVerificationChain([]);
    assert.deepEqual(await verify(input), {
      decision: "needs_review",
      details: { reason: "automatic_verifier_unavailable", attemptedVerifiers: [] },
      source: "manual_review",
    });
  });

  it("records when an automatic verifier was attempted but could not decide", async () => {
    const verify = createBillingPaymentVerificationChain([
      { id: "links_et", supports: () => true, verify: async () => ({ decision: "inconclusive" as const }) },
    ]);
    assert.deepEqual(await verify(input), {
      decision: "needs_review",
      details: {
        reason: "automatic_verification_inconclusive",
        attemptedVerifiers: ["links_et"],
      },
      source: "manual_review",
    });
  });
});
