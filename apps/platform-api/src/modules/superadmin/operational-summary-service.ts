import type {
  BillingStatusResult,
  PaymentOnboardingListResult,
  TenantDomainListResult,
  TenantReadinessResult,
} from "../../types/index.js";

export function createSuperadminOperationalSummaryService(options: {
  getBillingStatus: (input: { tenantId: string }) => Promise<BillingStatusResult>;
  getTenantReadiness: (input: { tenantId: string }) => Promise<TenantReadinessResult>;
  listPaymentOnboarding: (input: { tenantId: string }) => Promise<PaymentOnboardingListResult>;
  listTenantDomains: (input: { tenantId: string }) => Promise<TenantDomainListResult>;
}) {
  return async (input: { tenantId: string }) => {
    const [readinessResult, domainResult, billingResult, paymentResult] = await Promise.all([
      options.getTenantReadiness(input),
      options.listTenantDomains(input),
      options.getBillingStatus(input),
      options.listPaymentOnboarding(input),
    ]);
    if (!readinessResult.ok) return readinessResult;

    const readiness = readinessResult.readiness;
    const primary = domainResult.domains.find((domain) => domain.isPrimary) ?? null;
    return {
      ok: true as const,
      summary: {
        readiness: {
          ready: readiness.ready,
          missing: readiness.missing,
          tenantReady: readiness.checks.tenant.ready,
          domainReady: readiness.checks.domain.ready,
          commerceReady: readiness.checks.commerce.ready,
          storefrontReady: readiness.checks.storefront.ready,
          provisioningReady: readiness.checks.provisioning.ready,
        },
        storefront: {
          hasDraft: readiness.checks.storefront.hasDraft,
          isPublished: readiness.checks.storefront.isPublished,
        },
        domains: {
          total: domainResult.domains.length,
          custom: domainResult.domains.filter((domain) => domain.type === "custom_domain").length,
          pending: domainResult.domains.filter((domain) => domain.status !== "active").length,
          primaryHostname: primary?.hostname ?? null,
        },
        billing: billingResult.ok
          ? {
              available: true,
              planName: billingResult.billing.plan.name,
              subscriptionStatus: billingResult.billing.subscription.status,
              pendingInvoiceCount: billingResult.billing.invoices.filter(
                (invoice) => invoice.status === "pending",
              ).length,
            }
          : {
              available: false,
              planName: null,
              subscriptionStatus: null,
              pendingInvoiceCount: 0,
            },
        payments: {
          total: paymentResult.paymentOnboarding.length,
          pendingReview: paymentResult.paymentOnboarding.filter(
            (payment) => payment.status === "pending_review",
          ).length,
          approved: paymentResult.paymentOnboarding.filter(
            (payment) => payment.status === "approved",
          ).length,
        },
      },
    };
  };
}
