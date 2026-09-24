import type { createPlatformDb } from "@ecs/db";
import type { JobHandler } from "@ecs/jobs";

import { reconcileChapaBillingPayments } from "../../modules/billing/reconcile-payments.js";
import { createBillingProviderEventInbox } from "../../modules/billing/provider-event-inbox.js";
import { createBillingService } from "../../modules/billing/service.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

type ChapaVerifyLike = {
  data?: {
    ref_id?: unknown;
    reference?: unknown;
    status?: unknown;
  };
  status?: unknown;
};

/**
 * Re-verify pending platform billing Chapa payments and apply successes.
 * Closes the gap when callback_url never reached the API (local lvh.me,
 * tunnel drop, Chapa retry exhaustion) and the merchant never reopened Billing.
 */
export function createBillingPaymentReconcileHandler(options: {
  db: PlatformDb;
  /** Chapa transaction verify (secret-key). */
  verifyPayment: (txRef: string) => Promise<ChapaVerifyLike | undefined>;
  /** Max pending invoices to check per run. */
  limit?: number;
}): JobHandler {
  const billing = createBillingService(options.db);
  const inbox = createBillingProviderEventInbox(
    options.db,
    billing.completeChapaInvoicePayment,
  );
  const limit = options.limit ?? 100;

  return async () => {
    const inboxResult = await inbox.processDue({ limit });
    const items = await billing.listAllPendingChapaInvoiceTxRefs({ limit });
    const result = await reconcileChapaBillingPayments({
      items,
      verifyPayment: options.verifyPayment,
      completePayment: async (input) => {
        const processed = await inbox.recordAndProcessVerifiedPayment(input);
        if (processed.kind === "failed") {
          return { ok: false as const, error: "billing_provider_event_processing_failed" };
        }
        return {
          ok: true as const,
          applied: processed.kind === "completed" && processed.applied,
        };
      },
    });

    return {
      ok: true as const,
      ...result,
      inbox: inboxResult,
      scanned: items.length,
    };
  };
}
