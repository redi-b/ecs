import type { createLogger } from "@ecs/logger";
import type { createChapaPaymentService } from "../adapters/chapa/payment-service.js";
import { resolveChapaPayerEmail } from "../adapters/chapa/payment-service.js";
import { reconcileChapaBillingPayments } from "../modules/billing/reconcile-payments.js";
import type { createBillingRuntime } from "./billing.js";

type BillingRuntime = ReturnType<typeof createBillingRuntime>;
type ChapaPaymentService = ReturnType<typeof createChapaPaymentService>;
type PlatformLogger = Pick<ReturnType<typeof createLogger>, "warn">;

type BillingAppOptionsInput = {
  billingRuntime: BillingRuntime;
  chapaPaymentService: ChapaPaymentService;
  env: NodeJS.ProcessEnv;
  logger: PlatformLogger;
};

export function createBillingAppOptions(input: BillingAppOptionsInput) {
  const { billingService, planAdministrationService } = input.billingRuntime;

  return {
    getBillingStatus: billingService.getBillingStatus,
    createPlanUpgradeInvoice: billingService.createPlanUpgradeInvoice,
    getPublicPlanCatalog: billingService.getPublicPlanCatalog,
    startPlanTrial: billingService.startPlanTrial,
    schedulePlanDowngrade: billingService.schedulePlanDowngrade,
    cancelScheduledPlanDowngrade: billingService.cancelScheduledPlanDowngrade,
    submitBillingPaymentEvidence: billingService.submitBillingPaymentEvidence,
    updateBillingInvoiceStatus: billingService.updateBillingInvoiceStatus,
    listBillingPaymentReviews: billingService.listBillingPaymentReviews,
    getPlanAdministrationCatalog: planAdministrationService.getCatalog,
    createPlan: planAdministrationService.createPlan,
    savePlanPresentation: planAdministrationService.savePresentation,
    savePlanDraft: planAdministrationService.saveDraft,
    publishPlanDraft: planAdministrationService.publishDraft,
    migrateSubscriptionPlanVersion: planAdministrationService.migrateSubscriptionNow,

    confirmBillingPayments: async (request: { tenantId: string }) => {
      const pending = await billingService.listPendingChapaInvoiceTxRefs(request);
      const result = await reconcileChapaBillingPayments({
        items: pending,
        verifyPayment: (txRef) => input.chapaPaymentService.verifyPayment(txRef),
        completePayment: (payload) => billingService.completeChapaInvoicePayment(payload),
      });
      return { ok: true as const, confirmed: result.confirmed, checked: result.checked };
    },

    initializeBillingInvoicePayment: async (request: {
      invoiceId: string;
      payerEmail?: string | null;
      returnUrl: string;
      tenantId: string;
    }) => {
      if (!input.env.CHAPA_SECRET_KEY?.trim()) {
        return {
          ok: false as const,
          error: "billing_chapa_unavailable" as const,
          status: 503 as const,
        };
      }

      const email = resolveChapaPayerEmail(
        request.payerEmail,
        input.env.CHAPA_FALLBACK_EMAIL ?? input.env.EMAIL_FROM,
      );
      if (!email) {
        return {
          ok: false as const,
          error: "billing_payer_email_required" as const,
          status: 400 as const,
          message:
            "A valid email is required for Chapa. Set CHAPA_FALLBACK_EMAIL (e.g. you@gmail.com) in platform-api/.env for local demo accounts.",
        };
      }

      const pendingRefs = await billingService.listPendingChapaInvoiceTxRefs({
        tenantId: request.tenantId,
      });
      const prior = pendingRefs.find((row) => row.invoiceId === request.invoiceId);
      if (prior) {
        try {
          const verification = await input.chapaPaymentService.verifyPayment(prior.txRef);
          const status = String(verification?.data?.status ?? verification?.status ?? "")
            .trim()
            .toLowerCase();
          if (status === "success") {
            await billingService.completeChapaInvoicePayment({
              tenantId: request.tenantId,
              txRef: prior.txRef,
              providerReference:
                (typeof verification?.data?.ref_id === "string" && verification.data.ref_id) ||
                (typeof verification?.data?.reference === "string" &&
                  verification.data.reference) ||
                prior.txRef,
            });
            const statusResult = await billingService.getBillingStatus({
              tenantId: request.tenantId,
            });
            const paidInvoice = statusResult.ok
              ? statusResult.billing.invoices.find((invoice) => invoice.id === request.invoiceId)
              : null;
            return {
              ok: true as const,
              checkoutUrl: request.returnUrl,
              txRef: prior.txRef,
              invoice: paidInvoice ?? {
                id: request.invoiceId,
                amount: "0",
                currency: "ETB",
                status: "paid",
                dueAt: null,
                paidAt: new Date().toISOString(),
                provider: "chapa",
                providerReference: prior.txRef,
                createdAt: new Date().toISOString(),
              },
              alreadyPaid: true as const,
            };
          }
        } catch {
          // A stale or failed attempt should not prevent a fresh checkout.
        }
      }

      const prepared = await billingService.prepareInvoiceForChapaPayment({
        invoiceId: request.invoiceId,
        tenantId: request.tenantId,
      });
      if (!prepared.ok) return prepared;

      const platformPublic =
        input.env.PLATFORM_PUBLIC_BASE_URL?.trim() ||
        input.env.BETTER_AUTH_URL?.trim() ||
        "http://api.lvh.me";
      const callbackUrl = new URL("/platform/payments/chapa/callback", platformPublic);
      callbackUrl.searchParams.set("tenant_id", request.tenantId);
      callbackUrl.searchParams.set("tx_ref", prepared.txRef);

      try {
        const initialized = await input.chapaPaymentService.initializePayment({
          amount: prepared.amount,
          callbackUrl: callbackUrl.toString(),
          currency: prepared.currency,
          description: "Growth plan",
          email,
          returnUrl: request.returnUrl,
          title: "ECS Billing",
          txRef: prepared.txRef,
        });
        return {
          ok: true as const,
          checkoutUrl: initialized.checkoutUrl,
          txRef: initialized.txRef,
          invoice: prepared.invoice,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Chapa payment initialization failed.";
        input.logger.warn(
          { err: message, invoiceId: request.invoiceId, tenantId: request.tenantId },
          "billing_chapa_init_failed",
        );
        return {
          ok: false as const,
          error: "billing_chapa_init_failed" as const,
          status: 502 as const,
          message,
        };
      }
    },
  };
}
