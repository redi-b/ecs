export type BillingPaymentVerificationInput = {
  approvedRecipients: Array<{
    accountName: string;
    accountNumber: string;
  }>;
  amount: string;
  currency: string;
  invoiceId: string;
  issuedAt: Date;
  provider: string;
  reference: string;
  tenantId: string;
};

export type BillingPaymentVerificationResult = {
  decision: "verified" | "rejected" | "needs_review";
  details?: Record<string, unknown>;
  providerReference?: string;
  source: string;
};

export type BillingPaymentVerifier = {
  id: string;
  supports(input: BillingPaymentVerificationInput): boolean;
  verify(
    input: BillingPaymentVerificationInput,
  ): Promise<BillingPaymentVerificationResult | { decision: "inconclusive" }>;
};

/**
 * Runs provider adapters in order. A definitive rejection is never overridden
 * by a fallback. Inconclusive adapters fall through to the next verifier and,
 * finally, to operator review.
 */
export function createBillingPaymentVerificationChain(verifiers: BillingPaymentVerifier[]) {
  return async (
    input: BillingPaymentVerificationInput,
  ): Promise<BillingPaymentVerificationResult> => {
    const attempted: string[] = [];
    for (const verifier of verifiers) {
      if (!verifier.supports(input)) continue;
      attempted.push(verifier.id);
      const result = await verifier.verify(input);
      if (result.decision !== "inconclusive") return result;
    }
    return {
      decision: "needs_review",
      details: {
        reason:
          attempted.length > 0
            ? "automatic_verification_inconclusive"
            : "automatic_verifier_unavailable",
        attemptedVerifiers: attempted,
      },
      source: "manual_review",
    };
  };
}

export const manualBillingPaymentVerifier = createBillingPaymentVerificationChain([]);
