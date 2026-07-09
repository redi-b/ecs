import type {
  AnalyticsEventRecordInput,
  AnalyticsEventRecordResult,
  TenantInsightsSummaryResult,
} from "../analytics/analytics-service.js";
import type { TenantResolutionResult } from "../tenancy/tenant-resolver.js";
import type { BillingInvoiceUpdateResult, BillingStatusResult } from "./billing.js";
import type { DashboardMetricsResult } from "./metrics.js";
import type { DeliverySettingsResult, DeliverySettingsUpdateResult } from "./delivery.js";
import type {
  NotificationEventRecordResult,
  NotificationEventType,
  NotificationPreferenceListResult,
  NotificationPreferenceUpsertResult,
} from "./notifications.js";
import type {
  ChapaPaymentCallbackResult,
  PaymentOnboardingListResult,
  PaymentOnboardingReviewResult,
  PaymentOnboardingSubmitResult,
} from "./payments.js";
import type {
  PlatformOnboardingStateResult,
  TenantCommerceContextResult,
  TenantDashboardSummaryResult,
  TenantDetailResult,
  TenantDomainCreateResult,
  TenantDomainListResult,
  TenantDomainPrimaryResult,
  TenantHandleAvailabilityResult,
  TenantListResult,
  TenantOnboardingResult,
  TenantProvisioningAttemptListResult,
  TenantReadinessResult,
  TenantShopProvisioningResult,
  TenantShopSettingsUpdateResult,
  TenantStatusUpdateResult,
} from "./tenant.js";
import type { SupportHistoryResult, SupportNoteCreateResult } from "./support.js";
import type {
  MerchantBatchDeleteResult,
  MerchantDeleteResult,
  MerchantProductCategoriesResult,
  MerchantProductCategoryWriteResult,
  MerchantProductCollectionsResult,
  MerchantProductCollectionWriteResult,
  MerchantProductDetailResult,
  MerchantProductsResult,
  MerchantProductStockResult,
  MerchantProductStockUpdateResult,
  MerchantProductWriteResult,
} from "./merchant-product.js";
import type {
  MerchantOrderAction,
  MerchantOrderActionResult,
  MerchantOrderDetailResult,
  MerchantOrdersResult,
} from "./merchant-order.js";
import type {
  PublishedStorefrontConfigResult,
  StorefrontDraftResult,
  StorefrontDraftUpdateResult,
  StorefrontPublishResult,
  StorefrontTemplateCatalogItem,
  StorefrontTemplateSelectionResult,
} from "./storefront.js";
import type { DashboardAuthorizationResult, PlatformSession } from "./session.js";

export type PlatformAppOptions = {
  authorizeDashboardForTenant?:
    | ((input: { tenantId: string; userId: string }) => Promise<DashboardAuthorizationResult>)
    | undefined;
  authHandler?: ((request: Request) => Promise<Response>) | undefined;
  getSession?: ((headers: Headers) => Promise<PlatformSession | null>) | undefined;
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
  getPublishedStorefrontConfig?:
    | ((input: {
        publishedRevisionId: string;
        tenantId: string;
      }) => Promise<PublishedStorefrontConfigResult>)
    | undefined;
  getStorefrontDraft?:
    | ((input: { tenantId: string }) => Promise<StorefrontDraftResult>)
    | undefined;
  updateStorefrontDraft?:
    | ((input: {
        data: unknown;
        tenantId: string;
        themeTokens: unknown;
        userId: string;
      }) => Promise<StorefrontDraftUpdateResult>)
    | undefined;
  publishStorefrontDraft?:
    | ((input: { tenantId: string; userId: string }) => Promise<StorefrontPublishResult>)
    | undefined;
  getBillingStatus?: ((input: { tenantId: string }) => Promise<BillingStatusResult>) | undefined;
  getDashboardMetrics?:
    | ((input: { days: number; tenantId: string }) => Promise<DashboardMetricsResult>)
    | undefined;
  getDeliverySettings?:
    | ((input: { tenantId: string }) => Promise<DeliverySettingsResult>)
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
  getOperatorSupportHistory?:
    | ((input: { limit: number; tenantId: string }) => Promise<SupportHistoryResult>)
    | undefined;
  createOperatorSupportNote?:
    | ((input: {
        body: string;
        operatorUserId: string;
        tenantId: string;
        visibility?: string | null | undefined;
      }) => Promise<SupportNoteCreateResult>)
    | undefined;
  updateBillingInvoiceStatus?:
    | ((input: {
        invoiceId: string;
        operatorUserId: string;
        provider?: string | null | undefined;
        providerReference?: string | null | undefined;
        status: string;
        tenantId: string;
      }) => Promise<BillingInvoiceUpdateResult>)
    | undefined;
  updateTenantStatus?:
    | ((input: {
        operatorUserId: string;
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
        handle: string;
        name: string;
        tenantId: string;
        userId: string;
      }) => Promise<TenantShopSettingsUpdateResult>)
    | undefined;
  listTenantsForUser?:
    | ((input: { limit: number; offset: number; userId: string }) => Promise<TenantListResult>)
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
  createMerchantProduct?:
    | ((input: {
        categoryIds?: string[] | undefined;
        collectionId?: string | null | undefined;
        currencyCode?: string | null | undefined;
        description?: string | null | undefined;
        handle?: string | null | undefined;
        imageUrls?: string[] | undefined;
        options?: Array<{ title: string; values: string[] }> | undefined;
        priceAmount?: number | undefined;
        regionId?: string | null | undefined;
        salesChannelId: string;
        status?: string | null | undefined;
        thumbnail?: string | null | undefined;
        title: string;
        variants?:
          | Array<{
              currencyCode: string;
              optionValues: Record<string, string>;
              priceAmount: number;
              sku?: string | null | undefined;
              stockedQuantity?: number | undefined;
            }>
          | undefined;
      }) => Promise<MerchantProductWriteResult>)
    | undefined;
  createMerchantProductCategory?:
    | ((input: {
        handle?: string | null | undefined;
        name: string;
        tenantId: string;
      }) => Promise<MerchantProductCategoryWriteResult>)
    | undefined;
  createMerchantProductCollection?:
    | ((input: {
        handle?: string | null | undefined;
        tenantId: string;
        title: string;
      }) => Promise<MerchantProductCollectionWriteResult>)
    | undefined;
  createTenantShop?:
    | ((input: {
        handle: string;
        name: string;
        ownerUserId: string;
        templateId?: string | undefined;
        templateKey?: string | undefined;
      }) => Promise<TenantShopProvisioningResult>)
    | undefined;
  retryTenantShopProvisioningAttempt?:
    | ((input: { attemptId: string; userId: string }) => Promise<TenantShopProvisioningResult>)
    | undefined;
  createTenantDomain?:
    | ((input: {
        hostname: string;
        tenantId: string;
        userId: string;
      }) => Promise<TenantDomainCreateResult>)
    | undefined;
  listStorefrontTemplates?: (() => Promise<StorefrontTemplateCatalogItem[]>) | undefined;
  listTenantDomains?:
    | ((input: { tenantId: string }) => Promise<TenantDomainListResult>)
    | undefined;
  listPaymentOnboarding?:
    | ((input: { tenantId: string }) => Promise<PaymentOnboardingListResult>)
    | undefined;
  submitPaymentOnboarding?:
    | ((input: {
        notes?: string | null | undefined;
        provider: string;
        requiredDocuments: unknown[];
        tenantId: string;
        userId: string;
      }) => Promise<PaymentOnboardingSubmitResult>)
    | undefined;
  reviewPaymentOnboarding?:
    | ((input: {
        notes?: string | null | undefined;
        operatorUserId: string;
        paymentOnboardingId: string;
        providerAccountRef?: string | null | undefined;
        status: string;
        tenantId: string;
      }) => Promise<PaymentOnboardingReviewResult>)
    | undefined;
  setTenantPrimaryDomain?:
    | ((input: {
        domainId: string;
        tenantId: string;
        userId: string;
      }) => Promise<TenantDomainPrimaryResult>)
    | undefined;
  listMerchantProducts?:
    | ((input: {
        limit: number;
        offset: number;
        salesChannelId: string;
        stockLocationId?: string | null | undefined;
      }) => Promise<MerchantProductsResult>)
    | undefined;
  getMerchantProduct?:
    | ((input: {
        productId: string;
        salesChannelId: string;
      }) => Promise<MerchantProductDetailResult>)
    | undefined;
  listMerchantProductCategories?:
    | ((input: {
        limit: number;
        offset: number;
        tenantId: string;
      }) => Promise<MerchantProductCategoriesResult>)
    | undefined;
  listMerchantProductCollections?:
    | ((input: {
        limit: number;
        offset: number;
        tenantId: string;
      }) => Promise<MerchantProductCollectionsResult>)
    | undefined;
  getMerchantProductStock?:
    | ((input: {
        productId: string;
        salesChannelId: string;
        stockLocationId: string;
      }) => Promise<MerchantProductStockResult>)
    | undefined;
  getMerchantProductVariantStock?:
    | ((input: {
        productId: string;
        salesChannelId: string;
        stockLocationId: string;
        variantId: string;
      }) => Promise<MerchantProductStockResult>)
    | undefined;
  updateMerchantProductStock?:
    | ((input: {
        productId: string;
        salesChannelId: string;
        stockLocationId: string;
        stockedQuantity: number;
      }) => Promise<MerchantProductStockUpdateResult>)
    | undefined;
  updateMerchantProductVariantStock?:
    | ((input: {
        productId: string;
        salesChannelId: string;
        stockLocationId: string;
        stockedQuantity: number;
        variantId: string;
      }) => Promise<MerchantProductStockUpdateResult>)
    | undefined;
  listMerchantOrders?:
    | ((input: {
        limit: number;
        offset: number;
        salesChannelId: string;
      }) => Promise<MerchantOrdersResult>)
    | undefined;
  getMerchantOrder?:
    | ((input: { orderId: string; salesChannelId: string }) => Promise<MerchantOrderDetailResult>)
    | undefined;
  mutateMerchantOrder?:
    | ((input: {
        action: MerchantOrderAction;
        fulfillmentId?: string | undefined;
        orderId: string;
        salesChannelId: string;
        stockLocationId?: string | undefined;
      }) => Promise<MerchantOrderActionResult>)
    | undefined;
  listNotificationPreferences?:
    | ((input: { tenantId: string }) => Promise<NotificationPreferenceListResult>)
    | undefined;
  recordNotificationEvent?:
    | ((input: {
        eventType: NotificationEventType;
        payload?: unknown;
        tenantId: string;
      }) => Promise<NotificationEventRecordResult>)
    | undefined;
  upsertNotificationPreference?:
    | ((input: {
        channel: string;
        enabled: boolean;
        events: string[];
        target: string;
        tenantId: string;
        userId: string;
      }) => Promise<NotificationPreferenceUpsertResult>)
    | undefined;
  selectStorefrontTemplate?:
    | ((input: {
        tenantId: string;
        templateKey: string;
        userId: string;
      }) => Promise<StorefrontTemplateSelectionResult>)
    | undefined;
  updateMerchantProduct?:
    | ((input: {
        categoryIds?: string[] | undefined;
        collectionId?: string | null | undefined;
        description?: string | null | undefined;
        handle?: string | null | undefined;
        imageUrls?: string[] | undefined;
        productId: string;
        salesChannelId: string;
        status?: string | null | undefined;
        thumbnail?: string | null | undefined;
        title?: string | null | undefined;
      }) => Promise<MerchantProductWriteResult>)
    | undefined;
  deleteMerchantProduct?:
    | ((input: { productId: string; salesChannelId: string }) => Promise<MerchantDeleteResult>)
    | undefined;
  deleteMerchantProductsBatch?:
    | ((input: {
        productIds: string[];
        salesChannelId: string;
      }) => Promise<MerchantBatchDeleteResult>)
    | undefined;
  deleteMerchantProductCategory?:
    | ((input: { categoryId: string; tenantId: string }) => Promise<MerchantDeleteResult>)
    | undefined;
  deleteMerchantProductCategoriesBatch?:
    | ((input: { categoryIds: string[]; tenantId: string }) => Promise<MerchantBatchDeleteResult>)
    | undefined;
  deleteMerchantProductCollection?:
    | ((input: { collectionId: string; tenantId: string }) => Promise<MerchantDeleteResult>)
    | undefined;
  deleteMerchantProductCollectionsBatch?:
    | ((input: { collectionIds: string[]; tenantId: string }) => Promise<MerchantBatchDeleteResult>)
    | undefined;
  serviceName: string;
  medusaInternalUrl: string;
  platformPublicBaseUrl: string;
  medusaStoreFetch?: typeof fetch;
  resolveTenantForHost: (host?: string) => Promise<TenantResolutionResult>;
};



export type PlatformAppVariables = {
  requestId: string;
};
