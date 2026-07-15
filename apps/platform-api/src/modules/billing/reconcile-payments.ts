/**
 * Shared Chapa re-verify path for platform subscription invoices.
 * Used by return_url confirm, and by the billing.reconcile-payments worker job
 * when Chapa's callback_url never reached the API (local tunnel gaps, transient 5xx).
 *
 * Security: never trust callback/return query status alone — always verify with
 * CHAPA_SECRET_KEY via the Chapa transaction verify API before applying.
 */

export type PendingBillingChapaTx = {
  invoiceId: string;
  tenantId: string;
  txRef: string;
};

export type ChapaVerifyLike = {
  data?: {
    ref_id?: unknown;
    reference?: unknown;
    status?: unknown;
  };
  status?: unknown;
};

export async function reconcileChapaBillingPayments(options: {
  items: PendingBillingChapaTx[];
  verifyPayment: (txRef: string) => Promise<ChapaVerifyLike | undefined>;
  completePayment: (input: {
    providerReference: string | null;
    tenantId: string;
    txRef: string;
  }) => Promise<{ ok: boolean; applied?: boolean } | { ok: false; error: string }>;
}): Promise<{ checked: number; confirmed: number; errors: number }> {
  let checked = 0;
  let confirmed = 0;
  let errors = 0;

  for (const item of options.items) {
    checked += 1;
    try {
      const verification = await options.verifyPayment(item.txRef);
      const status = String(verification?.data?.status ?? verification?.status ?? "")
        .trim()
        .toLowerCase();
      if (status !== "success") {
        continue;
      }

      const providerReference =
        (typeof verification?.data?.ref_id === "string" && verification.data.ref_id) ||
        (typeof verification?.data?.reference === "string" && verification.data.reference) ||
        item.txRef;

      const result = await options.completePayment({
        tenantId: item.tenantId,
        txRef: item.txRef,
        providerReference,
      });

      if (result.ok && "applied" in result && result.applied) {
        confirmed += 1;
      }
    } catch {
      errors += 1;
    }
  }

  return { checked, confirmed, errors };
}
