export type ChapaPaymentCallbackResult =
  | {
      ok: true;
      eventType: "payment.failed" | "payment.paid";
      providerReference: string | null;
      status: string;
      tenantId: string;
      txRef: string;
    }
  | {
      ok: false;
      error:
        | "chapa_payment_not_found"
        | "chapa_verification_failed"
        | "missing_tenant_context"
        | "missing_tx_ref";
      status: 400 | 404 | 502;
    };


export type PaymentOnboarding = {
  id: string;
  provider: string;
  status: string;
  requiredDocuments: unknown;
  notes: string | null;
  providerAccountRef: string | null;
};


export type PaymentOnboardingListResult = {
  ok: true;
  paymentOnboarding: PaymentOnboarding[];
};


export type PaymentOnboardingSubmitResult =
  | {
      ok: true;
      paymentOnboarding: PaymentOnboarding;
    }
  | {
      ok: false;
      error: "payment_provider_invalid";
      status: 400;
    };


export type PaymentOnboardingReviewResult =
  | {
      ok: true;
      paymentOnboarding: PaymentOnboarding;
    }
  | {
      ok: false;
      error: "payment_onboarding_not_found" | "payment_onboarding_status_invalid";
      status: 400 | 404;
    };
