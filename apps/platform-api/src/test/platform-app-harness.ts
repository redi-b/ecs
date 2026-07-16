import type {
  AnalyticsEventRecordResult,
  BillingInvoiceUpdateResult,
  BillingStatusResult,
  ChapaPaymentCallbackResult,
  DeliverySettingsResult,
  DeliverySettingsUpdateResult,
  MerchantOrderAction,
  MerchantOrderActionResult,
  MerchantOrderDetailResult,
  MerchantOrdersResult,
  MerchantProductCategoriesResult,
  MerchantProductCategoryWriteResult,
  MerchantProductCollectionsResult,
  MerchantProductCollectionWriteResult,
  MerchantProductDetailResult,
  MerchantProductStockResult,
  MerchantProductStockUpdateResult,
  MerchantProductsResult,
  MerchantProductWriteResult,
  NotificationEventRecordResult,
  NotificationEventType,
  NotificationPreferenceListResult,
  NotificationPreferenceUpsertResult,
  PaymentOnboardingListResult,
  PaymentOnboardingReviewResult,
  PaymentOnboardingSubmitResult,
  PlatformOnboardingStateResult,
  PlatformSession,
  PublishedStorefrontConfigResult,
  StorefrontDraftResult,
  StorefrontDraftUpdateResult,
  StorefrontPublishResult,
  StorefrontTemplateCatalogItem,
  StorefrontTemplateSelectionResult,
  SupportHistoryResult,
  SupportNoteCreateResult,
  TenantCommerceContextResult,
  TenantDashboardSummaryResult,
  TenantDetailResult,
  TenantDomainCreateResult,
  TenantDomainListResult,
  TenantDomainPrimaryResult,
  TenantHandleAvailabilityResult,
  TenantInsightsSummaryResult,
  TenantListResult,
  TenantOnboardingResult,
  TenantProvisioningAttemptListResult,
  TenantReadinessResult,
  TenantShopProvisioningResult,
  TenantShopSettingsUpdateResult,
  TenantStatusUpdateResult,
} from "../app.js";
import { createPlatformApp } from "../app.js";

export type { MerchantOrderAction, NotificationEventType } from "../app.js";

import type { TenantContext, TenantResolutionResult } from "../tenancy/tenant-resolver.js";

export const resolvedTenantContext: TenantContext = {
  tenantId: "tenant_1",
  tenantName: "Abebe Market",
  tenantHandle: "abebe",
  hostname: "abebe.lvh.me",
  domainId: "domain_1",
  status: "active",
  medusaStoreId: "store_1",
  medusaSalesChannelId: "channel_1",
  medusaStockLocationId: "sloc_1",
  medusaPublishableKeyId: "pk_1",
  medusaRegionId: "reg_1",
  medusaShippingProfileId: "shp_1",
  medusaShippingOptionId: "so_1",
  publishedRevisionId: "revision_1",
  templateId: "template_1",
  templateKey: "classic@1",
  templateVersion: 1,
};

export function appWithResolution(
  result: TenantResolutionResult,
  options?: {
    authHandler?: (request: Request) => Promise<Response>;
    authorizeDashboardForTenant?: (input: { tenantId: string; userId: string }) => Promise<
      | {
          ok: true;
          actor: {
            id: string;
            email: string;
            name: string | null;
            role: "owner" | "manager" | "staff" | "operator";
          };
        }
      | {
          ok: false;
        }
    >;
    resolveTenantForHost?: (host?: string) => Promise<TenantResolutionResult>;
    getPublishedStorefrontConfig?: (input: {
      publishedRevisionId: string;
      tenantId: string;
    }) => Promise<PublishedStorefrontConfigResult>;
    handleChapaPaymentCallback?: (input: {
      providerReference?: string | null | undefined;
      reportedStatus?: string | null | undefined;
      tenantId?: string | null | undefined;
      txRef?: string | null | undefined;
    }) => Promise<ChapaPaymentCallbackResult>;
    recordAnalyticsEvent?: (input: {
      customerId?: string | null | undefined;
      eventType: string;
      idempotencyKey?: string | null | undefined;
      occurredAt?: string | null | undefined;
      properties?: unknown;
      sessionId?: string | null | undefined;
      source: "medusa" | "platform" | "storefront";
      subjectId?: string | null | undefined;
      subjectType?: string | null | undefined;
      tenantId: string;
    }) => Promise<AnalyticsEventRecordResult>;
    getSession?: (headers: Headers) => Promise<PlatformSession | null>;
    createMerchantProduct?: (input: {
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
    }) => Promise<MerchantProductWriteResult>;
    createMerchantProductCategory?: (input: {
      handle?: string | null | undefined;
      name: string;
      tenantId: string;
    }) => Promise<MerchantProductCategoryWriteResult>;
    createMerchantProductCollection?: (input: {
      handle?: string | null | undefined;
      tenantId: string;
      title: string;
    }) => Promise<MerchantProductCollectionWriteResult>;
    createTenantShop?: (input: {
      handle: string;
      name: string;
      ownerUserId: string;
      templateId?: string | undefined;
      templateKey?: string | undefined;
    }) => Promise<TenantShopProvisioningResult>;
    checkTenantHandleAvailability?: (input: {
      handle: string;
    }) => Promise<TenantHandleAvailabilityResult>;
    createTenantDomain?: (input: {
      hostname: string;
      tenantId: string;
      userId: string;
    }) => Promise<TenantDomainCreateResult>;
    getBillingStatus?: (input: { tenantId: string }) => Promise<BillingStatusResult>;
    getDeliverySettings?: (input: { tenantId: string }) => Promise<DeliverySettingsResult>;
    getMerchantChapaCredentials?: (input: { tenantId: string }) => Promise<
      | { ok: true; secretKey: string; providerAccountRef: string | null }
      | { ok: false; error: "merchant_chapa_not_configured" }
    >;
    isMerchantChapaConfigured?: (input: { tenantId: string }) => Promise<boolean>;
    updateDeliverySettings?: (input: {
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
    }) => Promise<DeliverySettingsUpdateResult>;
    updateBillingInvoiceStatus?: (input: {
      invoiceId: string;
      operatorUserId: string;
      provider?: string | null | undefined;
      providerReference?: string | null | undefined;
      status: string;
      tenantId: string;
    }) => Promise<BillingInvoiceUpdateResult>;
    getTenantOnboarding?: (input: { tenantId: string }) => Promise<TenantOnboardingResult>;
    getTenantForUser?: (input: { tenantId: string; userId: string }) => Promise<TenantDetailResult>;
    updateTenantShopSettings?: (input: {
      handle: string;
      name: string;
      tenantId: string;
      userId: string;
    }) => Promise<TenantShopSettingsUpdateResult>;
    getTenantInsightsSummary?: (input: {
      days: number;
      tenantId: string;
    }) => Promise<TenantInsightsSummaryResult>;
    getTenantCommerceContext?: (input: {
      tenantId: string;
      userId: string;
    }) => Promise<TenantCommerceContextResult>;
    getMerchantOrder?: (input: {
      orderId: string;
      salesChannelId: string;
    }) => Promise<MerchantOrderDetailResult>;
    getMerchantProduct?: (input: {
      productId: string;
      salesChannelId: string;
    }) => Promise<MerchantProductDetailResult>;
    mutateMerchantOrder?: (input: {
      action: MerchantOrderAction;
      fulfillmentId?: string | undefined;
      orderId: string;
      salesChannelId: string;
      stockLocationId?: string | undefined;
    }) => Promise<MerchantOrderActionResult>;
    getMerchantProductStock?: (input: {
      productId: string;
      salesChannelId: string;
      stockLocationId: string;
    }) => Promise<MerchantProductStockResult>;
    getMerchantProductVariantStock?: (input: {
      productId: string;
      salesChannelId: string;
      stockLocationId: string;
      variantId: string;
    }) => Promise<MerchantProductStockResult>;
    getTenantDashboardSummary?: (input: {
      tenantId: string;
    }) => Promise<TenantDashboardSummaryResult>;
    getTenantReadiness?: (input: { tenantId: string }) => Promise<TenantReadinessResult>;
    getOnboardingState?: (input: { userId: string }) => Promise<PlatformOnboardingStateResult>;
    listTenantsForUser?: (input: {
      limit: number;
      offset: number;
      userId: string;
    }) => Promise<TenantListResult>;
    listTenantProvisioningAttempts?: (input: {
      limit: number;
      offset: number;
      userId: string;
    }) => Promise<TenantProvisioningAttemptListResult>;
    retryTenantShopProvisioningAttempt?: (input: {
      attemptId: string;
      userId: string;
    }) => Promise<TenantShopProvisioningResult>;
    getOperatorSupportHistory?: (input: {
      limit: number;
      tenantId: string;
    }) => Promise<SupportHistoryResult>;
    getStorefrontDraft?: (input: { tenantId: string }) => Promise<StorefrontDraftResult>;
    updateStorefrontDraft?: (input: {
      data: unknown;
      tenantId: string;
      themeTokens: unknown;
      userId: string;
    }) => Promise<StorefrontDraftUpdateResult>;
    publishStorefrontDraft?: (input: {
      tenantId: string;
      userId: string;
    }) => Promise<StorefrontPublishResult>;
    createOperatorSupportNote?: (input: {
      body: string;
      operatorUserId: string;
      tenantId: string;
      visibility?: string | null | undefined;
    }) => Promise<SupportNoteCreateResult>;
    updateTenantStatus?: (input: {
      operatorUserId: string;
      reason?: string | null | undefined;
      status: string;
      tenantId: string;
    }) => Promise<TenantStatusUpdateResult>;
    listPaymentOnboarding?: (input: { tenantId: string }) => Promise<PaymentOnboardingListResult>;
    reviewPaymentOnboarding?: (input: {
      notes?: string | null | undefined;
      operatorUserId: string;
      paymentOnboardingId: string;
      providerAccountRef?: string | null | undefined;
      status: string;
      tenantId: string;
    }) => Promise<PaymentOnboardingReviewResult>;
    listTenantDomains?: (input: { tenantId: string }) => Promise<TenantDomainListResult>;
    listMerchantProducts?: (input: {
      limit: number;
      offset: number;
      salesChannelId: string;
    }) => Promise<MerchantProductsResult>;
    listMerchantProductCategories?: (input: {
      limit: number;
      offset: number;
      tenantId: string;
    }) => Promise<MerchantProductCategoriesResult>;
    listMerchantProductCollections?: (input: {
      limit: number;
      offset: number;
      tenantId: string;
    }) => Promise<MerchantProductCollectionsResult>;
    listMerchantOrders?: (
      input: import("../types/merchant-order.js").MerchantOrderListQuery,
    ) => Promise<MerchantOrdersResult>;
    listNotificationPreferences?: (input: {
      tenantId: string;
    }) => Promise<NotificationPreferenceListResult>;
    listStorefrontTemplates?: () => Promise<StorefrontTemplateCatalogItem[]>;
    medusaStoreFetch?: typeof fetch;
    recordNotificationEvent?: (input: {
      eventType: NotificationEventType;
      payload?: unknown;
      tenantId: string;
    }) => Promise<NotificationEventRecordResult>;
    setTenantPrimaryDomain?: (input: {
      domainId: string;
      tenantId: string;
      userId: string;
    }) => Promise<TenantDomainPrimaryResult>;
    submitPaymentOnboarding?: (input: {
      notes?: string | null | undefined;
      provider: string;
      requiredDocuments: unknown[];
      tenantId: string;
      userId: string;
    }) => Promise<PaymentOnboardingSubmitResult>;
    selectStorefrontTemplate?: (input: {
      tenantId: string;
      templateKey: string;
      userId: string;
    }) => Promise<StorefrontTemplateSelectionResult>;
    upsertNotificationPreference?: (input: {
      channel: string;
      enabled: boolean;
      events: string[];
      target: string;
      tenantId: string;
      userId: string;
    }) => Promise<NotificationPreferenceUpsertResult>;
    updateMerchantProduct?: (input: {
      categoryIds?: string[] | undefined;
      collectionId?: string | null | undefined;
      description?: string | null | undefined;
      handle?: string | null | undefined;
      productId: string;
      salesChannelId: string;
      status?: string | null | undefined;
      thumbnail?: string | null | undefined;
      title?: string | null | undefined;
    }) => Promise<MerchantProductWriteResult>;
    updateMerchantProductStock?: (input: {
      productId: string;
      salesChannelId: string;
      stockLocationId: string;
      stockedQuantity: number;
    }) => Promise<MerchantProductStockUpdateResult>;
    updateMerchantProductVariantStock?: (input: {
      productId: string;
      salesChannelId: string;
      stockLocationId: string;
      stockedQuantity: number;
      variantId: string;
    }) => Promise<MerchantProductStockUpdateResult>;
  },
) {
  return createPlatformApp({
    authHandler: options?.authHandler,
    authorizeDashboardForTenant: options?.authorizeDashboardForTenant,
    checkTenantHandleAvailability: options?.checkTenantHandleAvailability,
    createMerchantProduct: options?.createMerchantProduct,
    createMerchantProductCategory: options?.createMerchantProductCategory,
    createMerchantProductCollection: options?.createMerchantProductCollection,
    createTenantDomain: options?.createTenantDomain,
    createOperatorSupportNote: options?.createOperatorSupportNote,
    createTenantShop: options?.createTenantShop,
    getBillingStatus: options?.getBillingStatus,
    getDeliverySettings: options?.getDeliverySettings,
    getMerchantChapaCredentials: options?.getMerchantChapaCredentials,
    isMerchantChapaConfigured: options?.isMerchantChapaConfigured,
    handleChapaPaymentCallback: options?.handleChapaPaymentCallback,
    getPublishedStorefrontConfig: options?.getPublishedStorefrontConfig,
    getStorefrontDraft: options?.getStorefrontDraft,
    getOperatorSupportHistory: options?.getOperatorSupportHistory,
    getMerchantOrder: options?.getMerchantOrder,
    getMerchantProduct: options?.getMerchantProduct,
    getMerchantProductStock: options?.getMerchantProductStock,
    getMerchantProductVariantStock: options?.getMerchantProductVariantStock,
    getTenantForUser: options?.getTenantForUser,
    updateTenantShopSettings: options?.updateTenantShopSettings,
    getTenantCommerceContext: options?.getTenantCommerceContext,
    getTenantDashboardSummary: options?.getTenantDashboardSummary,
    getTenantInsightsSummary: options?.getTenantInsightsSummary,
    getTenantReadiness: options?.getTenantReadiness,
    getOnboardingState: options?.getOnboardingState,
    getTenantOnboarding: options?.getTenantOnboarding,
    getSession: options?.getSession,
    listMerchantProducts: options?.listMerchantProducts,
    listMerchantProductCategories: options?.listMerchantProductCategories,
    listMerchantProductCollections: options?.listMerchantProductCollections,
    listMerchantOrders: options?.listMerchantOrders,
    listNotificationPreferences: options?.listNotificationPreferences,
    listTenantsForUser: options?.listTenantsForUser,
    listTenantProvisioningAttempts: options?.listTenantProvisioningAttempts,
    listPaymentOnboarding: options?.listPaymentOnboarding,
    reviewPaymentOnboarding: options?.reviewPaymentOnboarding,
    listTenantDomains: options?.listTenantDomains,
    listStorefrontTemplates: options?.listStorefrontTemplates,
    mutateMerchantOrder: options?.mutateMerchantOrder,
    selectStorefrontTemplate: options?.selectStorefrontTemplate,
    updateMerchantProduct: options?.updateMerchantProduct,
    updateMerchantProductStock: options?.updateMerchantProductStock,
    updateMerchantProductVariantStock: options?.updateMerchantProductVariantStock,
    serviceName: "platform-api",
    medusaInternalUrl: "http://medusa:9000",
    platformPublicBaseUrl: "http://api.lvh.me",
    ...(options?.medusaStoreFetch ? { medusaStoreFetch: options.medusaStoreFetch } : {}),
    setTenantPrimaryDomain: options?.setTenantPrimaryDomain,
    submitPaymentOnboarding: options?.submitPaymentOnboarding,
    updateBillingInvoiceStatus: options?.updateBillingInvoiceStatus,
    updateDeliverySettings: options?.updateDeliverySettings,
    publishStorefrontDraft: options?.publishStorefrontDraft,
    recordAnalyticsEvent: options?.recordAnalyticsEvent,
    recordNotificationEvent: options?.recordNotificationEvent,
    retryTenantShopProvisioningAttempt: options?.retryTenantShopProvisioningAttempt,
    upsertNotificationPreference: options?.upsertNotificationPreference,
    updateTenantStatus: options?.updateTenantStatus,
    updateStorefrontDraft: options?.updateStorefrontDraft,
    resolveTenantForHost: options?.resolveTenantForHost ?? (async () => result),
  });
}
