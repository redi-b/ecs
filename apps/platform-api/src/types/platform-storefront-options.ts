import type {
  AnalyticsEventRecordInput,
  AnalyticsEventRecordResult,
  TenantInsightsSummaryResult,
} from "../modules/analytics/analytics-service.js";
import type { createInsightsDemandService } from "../modules/analytics/insights-demand.js";
import type { createInsightsProductsService } from "../modules/analytics/insights-products.js";
import type { createInsightsSalesService } from "../modules/analytics/insights-sales.js";
import type { createInsightsStorefrontService } from "../modules/analytics/insights-storefront.js";
import type { StorefrontBehaviorEvent } from "../modules/analytics/storefront-analytics-bridge.js";
import type { StorefrontInsightsSnapshot } from "../modules/analytics/storefront-insights-service.js";
import type {
  BillingCancelDowngradeResult,
  BillingInvoicePayResult,
  BillingInvoiceUpdateResult,
  BillingPlanDowngradeResult,
  BillingPlanUpgradeResult,
  BillingStatusResult,
} from "./billing.js";
import type { DeliverySettingsResult, DeliverySettingsUpdateResult } from "./delivery.js";
import type { DashboardMetricsResult } from "./metrics.js";
import type { ChapaPaymentCallbackResult } from "./payments.js";
import type {
  PublishedStorefrontConfigResult,
  StorefrontDraftResult,
  StorefrontDraftUpdateResult,
  StorefrontPublishResult,
  StorefrontSeoSettings,
  StorefrontSeoSettingsResult,
  StorefrontUnpublishResult,
} from "./storefront.js";
import type { SupportHistoryResult, SupportNoteCreateResult } from "./support.js";
import type {
  PlatformOnboardingStateResult,
  TenantCommerceContextResult,
  TenantDashboardSummaryResult,
  TenantDetailResult,
  TenantHandleAvailabilityResult,
  TenantListResult,
  TenantOnboardingResult,
  TenantProvisioningAttemptListResult,
  TenantReadinessResult,
  TenantShopSettingsUpdateResult,
  TenantStatusUpdateResult,
} from "./tenant.js";

export type PlatformStorefrontOptions = {
  handleChapaPaymentCallback?:
    | ((input: {
        providerReference?: string | null | undefined;
        reportedStatus?: string | null | undefined;
        tenantId?: string | null | undefined;
        txRef?: string | null | undefined;
      }) => Promise<ChapaPaymentCallbackResult>)
    | undefined;
  recordAnalyticsEvent?:
    | ((input: AnalyticsEventRecordInput) => Promise<AnalyticsEventRecordResult>)
    | undefined;
  recordStorefrontBehavior?:
    | ((input: StorefrontBehaviorEvent) => Promise<{ delivered: boolean }>)
    | undefined;
  getPublishedStorefrontConfig?:
    | ((input: {
        publishedRevisionId: string;
        tenantId: string;
      }) => Promise<PublishedStorefrontConfigResult>)
    | undefined;
  getStorefrontDraft?:
    | ((input: { tenantId: string }) => Promise<StorefrontDraftResult>)
    | undefined;
  getStorefrontSeoSettings?:
    | ((input: { tenantId: string }) => Promise<StorefrontSeoSettingsResult>)
    | undefined;
  updateStorefrontSeoSettings?:
    | ((input: {
        seo: StorefrontSeoSettings;
        tenantId: string;
        userId: string;
      }) => Promise<StorefrontSeoSettingsResult>)
    | undefined;
  updateStorefrontDraft?:
    | ((input: {
        data: unknown;
        languageSettings?: import("@ecs/contracts").StorefrontLanguageSettings;
        localizedContent?: import("@ecs/contracts").StorefrontLocalizedContent;
        tenantId: string;
        themeTokens: unknown;
        userId: string;
      }) => Promise<StorefrontDraftUpdateResult>)
    | undefined;
  publishStorefrontDraft?:
    | ((input: { tenantId: string; userId: string }) => Promise<StorefrontPublishResult>)
    | undefined;
  unpublishStorefront?:
    | ((input: { tenantId: string; userId: string }) => Promise<StorefrontUnpublishResult>)
    | undefined;
  getBillingStatus?: ((input: { tenantId: string }) => Promise<BillingStatusResult>) | undefined;
  getPublicPlanCatalog?: ReturnType<
    typeof import("../modules/billing/service.js").createBillingService
  >["getPublicPlanCatalog"];
  startPlanTrial?: ReturnType<
    typeof import("../modules/billing/service.js").createBillingService
  >["startPlanTrial"];
  createPlanUpgradeInvoice?:
    | ((input: { planId: string; tenantId: string }) => Promise<BillingPlanUpgradeResult>)
    | undefined;
  schedulePlanDowngrade?:
    | ((input: { planId: string; tenantId: string }) => Promise<BillingPlanDowngradeResult>)
    | undefined;
  cancelScheduledPlanDowngrade?:
    | ((input: { tenantId: string }) => Promise<BillingCancelDowngradeResult>)
    | undefined;
  initializeBillingInvoicePayment?:
    | ((input: {
        invoiceId: string;
        payerEmail: string;
        returnUrl: string;
        tenantId: string;
      }) => Promise<BillingInvoicePayResult>)
    | undefined;
  submitBillingPaymentEvidence?: ReturnType<
    typeof import("../modules/billing/service.js").createBillingService
  >["submitBillingPaymentEvidence"];
  /** Re-verify pending Chapa plan invoices after return_url (local/dev without public callback). */
  confirmBillingPayments?:
    | ((input: { tenantId: string }) => Promise<{
        ok: true;
        confirmed: number;
        checked: number;
      }>)
    | undefined;
  getDashboardMetrics?:
    | ((input: { days: number | null; tenantId: string }) => Promise<DashboardMetricsResult>)
    | undefined;
  getInsightsSales?: ReturnType<typeof createInsightsSalesService> | undefined;
  getInsightsProducts?: ReturnType<typeof createInsightsProductsService> | undefined;
  getInsightsDemand?: ReturnType<typeof createInsightsDemandService> | undefined;
  getInsightsStorefront?: ReturnType<typeof createInsightsStorefrontService> | undefined;
  requestInsightsRefresh?:
    | ((input: { tenantId: string }) => Promise<{
        jobId: string;
        queued: boolean;
        requestedAt: string;
        retryAt: string;
        status: string;
      }>)
    | undefined;
  getDeliverySettings?:
    | ((input: { tenantId: string }) => Promise<DeliverySettingsResult>)
    | undefined;
  /** Merchant store Chapa credentials — never platform billing env key. */
  getMerchantChapaCredentials?:
    | ((input: {
        tenantId: string;
        requireOnlineEnabled?: boolean;
      }) => Promise<
        | { ok: true; secretKey: string; providerAccountRef: string | null }
        | { ok: false; error: "merchant_chapa_not_configured" }
      >)
    | undefined;
  isMerchantChapaConfigured?: ((input: { tenantId: string }) => Promise<boolean>) | undefined;
  getMerchantStorePaymentStatus?:
    | ((input: { tenantId: string }) => Promise<{
        ok: true;
        payment: {
          cod: true;
          chapa: {
            configured: boolean;
            onlineEnabled: boolean;
            credentialsValidated: boolean;
            secretFingerprint: string | null;
            status: string;
          };
        };
      }>)
    | undefined;
  setMerchantChapaSecret?:
    | ((input: {
        tenantId: string;
        secretKey: string;
        userId?: string;
        onlineEnabled?: boolean;
        providerAccountRef?: string | null;
      }) => Promise<
        | { ok: true; fingerprint: string }
        | { ok: false; error: "payment_provider_invalid" | "encryption_unavailable" }
      >)
    | undefined;
  setMerchantChapaOnlineEnabled?:
    | ((input: {
        tenantId: string;
        onlineEnabled: boolean;
        userId?: string;
      }) => Promise<{ ok: true } | { ok: false; error: "merchant_chapa_not_configured" }>)
    | undefined;
  clearMerchantChapaSecret?:
    | ((input: {
        tenantId: string;
        userId?: string;
      }) => Promise<{ ok: true } | { ok: false; error: "merchant_chapa_not_configured" }>)
    | undefined;
  updateDeliverySettings?:
    | ((input: {
        currency: string;
        defaultDeliveryFee: string;
        deliveryEnabled: boolean;
        landmarkRequired: boolean;
        notesEnabled: boolean;
        phoneConfirmationRequired: boolean;
        pickupEnabled: boolean;
        tenantId: string;
        userId: string;
        zones: unknown[];
      }) => Promise<DeliverySettingsUpdateResult>)
    | undefined;
  /** Push default delivery fee onto Medusa shipping option (checkout amount). */
  syncDeliveryShippingPrice?:
    | ((input: {
        amount: number;
        currencyCode: string;
        tenantId: string;
        userId: string;
      }) => Promise<
        | { ok: true }
        | {
            ok: false;
            error:
              | "commerce_backend_unavailable"
              | "commerce_backend_error"
              | "delivery_shipping_option_unavailable"
              | "pickup_option_sync_failed";
          }
      >)
    | undefined;
  /** Ensure free Store Pickup option exists for the tenant delivery zone. */
  ensurePickupOption?:
    | ((input: {
        currencyCode: string;
        deliveryShippingOptionId: string;
      }) => Promise<{ ok: true; pickupOptionId: string; created: boolean } | { ok: false }>)
    | undefined;
  getOperatorSupportHistory?:
    | ((input: { limit: number; tenantId: string }) => Promise<SupportHistoryResult>)
    | undefined;
  createOperatorSupportNote?:
    | ((input: {
        body: string;
        operatorUserId: string;
        platformPrincipalId: string;
        tenantId: string;
        visibility?: string | null | undefined;
      }) => Promise<SupportNoteCreateResult>)
    | undefined;
  listSupportAccessGrants?: ReturnType<
    typeof import("../modules/support/access-service.js").createSupportAccessService
  >["list"];
  createSupportAccessGrant?: ReturnType<
    typeof import("../modules/support/access-service.js").createSupportAccessService
  >["create"];
  revokeSupportAccessGrant?: ReturnType<
    typeof import("../modules/support/access-service.js").createSupportAccessService
  >["revoke"];
  updateBillingInvoiceStatus?:
    | ((input: {
        invoiceId: string;
        operatorUserId: string;
        platformPrincipalId: string;
        provider?: string | null | undefined;
        providerReference?: string | null | undefined;
        reason: string;
        status: string;
        tenantId: string;
      }) => Promise<BillingInvoiceUpdateResult>)
    | undefined;
  listBillingPaymentReviews?:
    | ((input: { limit: number; offset: number }) => Promise<{
        count: number;
        items: Array<{
          amount: string;
          createdAt: string;
          currency: string;
          evidenceId: string;
          invoiceId: string;
          provider: string;
          reference: string;
          tenantHandle: string;
          tenantId: string;
          tenantName: string;
          verificationSource: string | null;
        }>;
      }>)
    | undefined;
  updateTenantStatus?:
    | ((input: {
        operatorUserId: string;
        platformPrincipalId: string;
        reason?: string | null | undefined;
        status: string;
        tenantId: string;
      }) => Promise<TenantStatusUpdateResult>)
    | undefined;
  getTenantReadiness?:
    | ((input: { tenantId: string }) => Promise<TenantReadinessResult>)
    | undefined;
  getTenantInsightsSummary?:
    | ((input: { days: number; tenantId: string }) => Promise<TenantInsightsSummaryResult>)
    | undefined;
  getStorefrontInsights?:
    | ((input: {
        days: number;
        hostname: string;
        name: string;
        tenantId: string;
      }) => Promise<StorefrontInsightsSnapshot>)
    | undefined;
  getTenantCommerceContext?:
    | ((input: { tenantId: string; userId: string }) => Promise<TenantCommerceContextResult>)
    | undefined;
  getTenantDashboardSummary?:
    | ((input: { tenantId: string }) => Promise<TenantDashboardSummaryResult>)
    | undefined;
  getTenantForUser?:
    | ((input: { tenantId: string; userId: string }) => Promise<TenantDetailResult>)
    | undefined;
  updateTenantShopSettings?:
    | ((input: {
        shopDetails?: import("@ecs/contracts").ShopDetails;
        handle: string;
        name: string;
        tenantId: string;
        userId: string;
      }) => Promise<TenantShopSettingsUpdateResult>)
    | undefined;
  listTenantsForUser?:
    | ((input: { limit: number; offset: number; userId: string }) => Promise<TenantListResult>)
    | undefined;
  getTenantMembershipSummary?:
    | ((input: { userId: string }) => Promise<{ accessibleCount: number; ownedCount: number }>)
    | undefined;
  checkTenantHandleAvailability?:
    | ((input: { handle: string }) => Promise<TenantHandleAvailabilityResult>)
    | undefined;
  getOnboardingState?:
    | ((input: { userId: string }) => Promise<PlatformOnboardingStateResult>)
    | undefined;
  listTenantProvisioningAttempts?:
    | ((input: {
        limit: number;
        offset: number;
        userId: string;
      }) => Promise<TenantProvisioningAttemptListResult>)
    | undefined;
  getTenantOnboarding?:
    | ((input: { tenantId: string }) => Promise<TenantOnboardingResult>)
    | undefined;
};
