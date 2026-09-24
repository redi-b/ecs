import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createLinksEtBillingPaymentVerifier,
  isAcceptedLinksEtReference,
} from "./links-et-payment-verifier.js";

const base = {
  approvedRecipients: [{ accountName: "ECS PLC", accountNumber: "251911223344" }],
  amount: "1000",
  currency: "ETB",
  invoiceId: "invoice-1",
  issuedAt: new Date("2026-09-01T00:00:00.000Z"),
  provider: "telebirr",
  reference: "ABCD1234EF",
  tenantId: "tenant-1",
};

describe("Links.et billing payment verifier", () => {
  it("verifies a completed receipt only when amount, recipient, and date match", async () => {
    const verifier = createLinksEtBillingPaymentVerifier({
      apiKey: "vk_live_test",
      fetchImpl: async (_url, init) => {
        assert.equal(new Headers(init?.headers).get("x-api-key"), "vk_live_test");
        assert.match(new Headers(init?.headers).get("idempotency-key") ?? "", /^ecs-billing-/);
        return Response.json({
          ok: true,
          providerKey: "telebirr",
          receipt: {
            source: "telebirr-html",
            creditedPartyName: "ECS PLC",
            creditedPartyAccountNo: "2519****3344",
            transactionStatus: "Completed",
            receiptNo: "ABCD1234EF",
            paymentDate: "02-09-2026 10:30:00",
            settledAmount: "1,000 Birr",
          },
        });
      },
    });

    const result = await verifier.verify(base);
    assert.equal(result.decision, "verified");
    if (result.decision === "verified") {
      assert.equal(result.providerReference, "ABCD1234EF");
      assert.equal(result.source, "links_et");
    }
  });

  it("rejects a real receipt that does not match the invoice amount", async () => {
    const verifier = createLinksEtBillingPaymentVerifier({
      apiKey: "vk_live_test",
      fetchImpl: async () =>
        Response.json({
          ok: true,
          providerKey: "telebirr",
          receipt: {
            source: "telebirr-html",
            creditedPartyName: "ECS PLC",
            transactionStatus: "Completed",
            receiptNo: "ABCD1234EF",
            paymentDate: "02-09-2026 10:30:00",
            settledAmount: "900 Birr",
          },
        }),
    });

    const result = await verifier.verify(base);
    assert.equal(result.decision, "rejected");
    if (result.decision === "rejected") {
      assert.equal(result.details?.reason, "amount_mismatch");
      assert.equal(result.details?.receiptSource, "telebirr-html");
      assert.equal(typeof result.details?.responseHash, "string");
    }
  });

  it("does not send arbitrary URLs to the external verifier", () => {
    const verifier = createLinksEtBillingPaymentVerifier({ apiKey: "vk_live_test" });
    assert.equal(
      verifier.supports({ ...base, provider: "cbe", reference: "https://example.com/receipt" }),
      false,
    );
    assert.equal(
      verifier.supports({
        ...base,
        provider: "cbe",
        reference: "https://mbreciept.cbe.com.et/fHCxz62uM8157lCfet",
      }),
      true,
    );
  });

  it("accepts only references that Links.et can actually verify", () => {
    assert.equal(isAcceptedLinksEtReference("telebirr", "ABCD1234EF"), true);
    assert.equal(isAcceptedLinksEtReference("telebirr", "invalid"), false);
    assert.equal(
      isAcceptedLinksEtReference("cbe", "https://mbreciept.cbe.com.et/fHCxz62uM8157lCfet"),
      true,
    );
    assert.equal(isAcceptedLinksEtReference("cbe", "FT26230KYLL0"), false);
  });

  it("falls back to review when Links.et or its upstream is unavailable", async () => {
    const verifier = createLinksEtBillingPaymentVerifier({
      apiKey: "vk_live_test",
      fetchImpl: async () => new Response(null, { status: 503 }),
    });
    assert.deepEqual(await verifier.verify(base), { decision: "inconclusive" });
  });
});
