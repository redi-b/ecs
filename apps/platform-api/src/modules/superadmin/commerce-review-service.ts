import type { SuperadminCommerceReview } from "@ecs/contracts";

import type { BillingStatusResult, PaymentOnboardingListResult } from "../../types/index.js";

export function createSuperadminCommerceReviewService(options: {
  getBillingStatus: (input: { tenantId: string }) => Promise<BillingStatusResult>;
  listPaymentOnboarding: (input: { tenantId: string }) => Promise<PaymentOnboardingListResult>;
}) {
  return async (input: {
    includeBilling: boolean;
    includePayments: boolean;
    tenantId: string;
  }): Promise<SuperadminCommerceReview> => {
    const [billingResult, paymentResult] = await Promise.all([
      input.includeBilling ? options.getBillingStatus(input) : null,
      input.includePayments ? options.listPaymentOnboarding(input) : null,
    ]);
    return {
      billing: billingResult?.ok
        ? {
            planName: billingResult.billing.plan.name,
            subscriptionStatus: billingResult.billing.subscription.status,
            billingCycle: billingResult.billing.subscription.billingCycle,
            currentPeriodEnd: billingResult.billing.subscription.currentPeriodEnd,
            invoices: billingResult.billing.invoices,
          }
        : null,
      paymentOnboarding:
        paymentResult?.paymentOnboarding.map((payment) => ({
          id: payment.id,
          provider: payment.provider,
          status: payment.status,
          requiredDocuments: Array.isArray(payment.requiredDocuments)
            ? payment.requiredDocuments.filter(
                (document): document is string => typeof document === "string" && Boolean(document),
              )
            : [],
          notes: payment.notes,
          providerAccountRef: payment.providerAccountRef,
        })) ?? null,
    };
  };
}
