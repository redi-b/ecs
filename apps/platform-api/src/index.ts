import { loadServiceEnv } from "@ecs/config";
import { createPlatformDb } from "@ecs/db";
import { createLogger } from "@ecs/logger";
import { createPlatformApp } from "./app.js";
import { createAnalyticsRuntime } from "./bootstrap/analytics.js";
import { createAuthRuntime } from "./bootstrap/auth.js";
import { createBillingRuntime } from "./bootstrap/billing.js";
import { createBillingAppOptions } from "./bootstrap/billing-app-options.js";
import { createCommerceRuntime } from "./bootstrap/commerce.js";
import { createCommerceAppOptions } from "./bootstrap/commerce-app-options.js";
import { createDeliveryRuntime } from "./bootstrap/delivery.js";
import { createEmailRuntime } from "./bootstrap/email.js";
import { createJobsRuntime } from "./bootstrap/jobs.js";
import { createMediaRuntime } from "./bootstrap/media.js";
import { createMediaAppOptions } from "./bootstrap/media-app-options.js";
import { createPaymentRuntime } from "./bootstrap/payments.js";
import { createPlatformOperationsRuntime } from "./bootstrap/platform-operations.js";
import { createPlatformOperationsAppOptions } from "./bootstrap/platform-operations-app-options.js";
import { startPlatformServer } from "./bootstrap/server-lifecycle.js";
import { createTelegramRuntime } from "./bootstrap/telegram.js";
import { createTenantRuntime } from "./bootstrap/tenant.js";
import { createTenantManagementRuntime } from "./bootstrap/tenant-management.js";
import { loadPlatformApiEnvFiles } from "./config/env.js";
import { assertPlatformProductionEnvironment } from "./config/production-environment.js";
import { getSystemHosts } from "./config/hosts.js";
import { createDomainTenantLookup } from "./context/domain-tenant-lookup.js";
import { parseTrustedOrigins } from "./context/platform-auth.js";
import { resolveTenantFromHost } from "./context/tenant-resolver.js";
import { createDataExportAuditRecorder } from "./modules/data-transfer/export-audit.js";
import { createProductImportArtifactService } from "./modules/data-transfer/product-import-artifact.js";
import { createLaunchReadinessService } from "./modules/onboarding/launch-readiness.js";
import { createCustomerCommerceService } from "./modules/storefront/customer-commerce-service.js";
import { createStorefrontInquiryService } from "./modules/storefront/inquiry-service.js";
import { createStorefrontTemplateService } from "./modules/storefront/template-service.js";

loadPlatformApiEnvFiles();

assertPlatformProductionEnvironment(process.env);

const env = loadServiceEnv({
  ...process.env,
  SERVICE_NAME: process.env.SERVICE_NAME ?? "platform-api",
});

const logger = createLogger({
  serviceName: env.SERVICE_NAME,
  environment: env.NODE_ENV,
});

const platformDb = createPlatformDb({
  connectionString:
    process.env.PLATFORM_DATABASE_URL ??
    `postgres://ecs:ecs@localhost:${process.env.POSTGRES_HOST_PORT ?? "5432"}/platform_db`,
  max: Number.parseInt(process.env.PLATFORM_DATABASE_POOL_MAX ?? "5", 10),
  idleTimeoutMillis: Number.parseInt(
    process.env.PLATFORM_DATABASE_POOL_IDLE_TIMEOUT_MS ?? "30000",
    10,
  ),
});
const findDomainByHostname = createDomainTenantLookup(platformDb.db);
const billingRuntime = createBillingRuntime({ db: platformDb.db, env: process.env, logger });
const { billingProviderEventInbox, billingService } = billingRuntime;
const recordMerchantDataExport = createDataExportAuditRecorder(platformDb.db);
const productImportArtifactService = createProductImportArtifactService(platformDb.db);
const storefrontInquiryService = createStorefrontInquiryService(platformDb.db);
const customerCommerceService = createCustomerCommerceService(platformDb.db);
const mediaRuntime = createMediaRuntime({ db: platformDb.db, env: process.env, logger });
const {
  demoBaseUrl: storefrontDemoBaseUrl,
  platformTemplateAssetService,
  setUpdateProductMediaVariants,
  storage: mediaStorage,
} = mediaRuntime;

const {
  enqueueJob,
  jobsClient,
  notificationService,
  productImportExecutionService,
  requestInsightsRefresh,
} = createJobsRuntime({ db: platformDb.db, env: process.env, logger });
const mediaAppOptions = createMediaAppOptions({ jobsClient, runtime: mediaRuntime });

const telegramRuntime = createTelegramRuntime({
  db: platformDb.db,
  env: process.env,
  logger,
});
const telegramConnectService = telegramRuntime.connectService;

const {
  appOptions: emailAppOptions,
  emailDeliveryService,
  emailProvider: authEmailProvider,
  requireEmailVerification,
} = createEmailRuntime({
  db: platformDb.db,
  enqueueJob,
  env: process.env,
  logger,
  telegramConfigured: telegramConnectService.isConfigured(),
});
const {
  analyticsInsightsService,
  analyticsService,
  dashboardMetricsService,
  getInsightsDemand,
  getInsightsProducts,
  getInsightsSales,
  getInsightsStorefront,
  getStorefrontInsights,
  storefrontAnalyticsBridge,
} = createAnalyticsRuntime({ db: platformDb.db, env: process.env, logger });
const {
  domainManagementService,
  entitlementService,
  getTenantCommerceContext,
  getTenantDashboardSummary,
  getTenantForUser,
  getTenantMembershipSummary,
  listTenantsForUser,
  paymentOnboardingService,
  receivingAccountsService,
  tenantOnboardingService,
  tenantStatusService,
} = createTenantManagementRuntime({ db: platformDb.db, env: process.env });
const platformOperationsRuntime = createPlatformOperationsRuntime({
  billingService,
  db: platformDb.db,
  domainManagementService,
  env: process.env,
  jobsClient,
  mediaStorage,
  paymentOnboardingService,
  tenantStatusService,
});
const { medusaInternalUrl } = platformOperationsRuntime;
const platformInternalApiToken =
  process.env.PLATFORM_INTERNAL_API_TOKEN ??
  (process.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token");

const platformPublicBaseUrl =
  process.env.PLATFORM_PUBLIC_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://api.lvh.me";
const platformBaseDomain = process.env.STOREFRONT_PUBLIC_BASE_DOMAIN ?? "lvh.me";
const {
  checkTenantHandleAvailability,
  createTenantShop,
  ensureTenantPickupOption,
  getOnboardingState,
  listTenantProvisioningAttempts,
  recoverSuperadminWork,
  resolveTenantIdByMedusaSalesChannelId,
  retryTenantShopProvisioningAttempt,
  updateTenantShippingPrice,
  updateTenantShopSettings,
} = createTenantRuntime({
  db: platformDb.db,
  internalApiToken: platformInternalApiToken,
  listTenantsForUser,
  medusaInternalUrl,
  platformBaseDomain,
  recordAnalyticsEvent: analyticsService.recordAnalyticsEvent,
});
const deliveryAppOptions = createDeliveryRuntime({
  db: platformDb.db,
  ensureTenantPickupOption,
  getTenantCommerceContext,
  logger,
  updateTenantShippingPrice,
});
const platformOperationsAppOptions = createPlatformOperationsAppOptions({
  entitlementService,
  jobsClient,
  recoverSuperadminWork,
  runtime: platformOperationsRuntime,
});
const commerceRuntime = await createCommerceRuntime({
  db: platformDb.db,
  env: process.env,
  logger,
  recordNotificationEvent: notificationService.recordNotificationEvent,
  resolveTenantIdBySalesChannelId: resolveTenantIdByMedusaSalesChannelId,
});
const { customerService, manualOrderService, orderService, productService } = commerceRuntime;
const commerceAppOptions = createCommerceAppOptions({
  db: platformDb.db,
  resolveTenantIdByMedusaSalesChannelId,
  runtime: commerceRuntime,
});
telegramRuntime.setOrderHandlers({
  mutateMerchantOrder: (input) =>
    orderService.mutateMerchantOrder({
      ...input,
      source: input.source ?? (input.action === "mark-paid" ? "telegram" : undefined),
    }),
  getMerchantOrder: (input) => orderService.getMerchantOrder(input),
});
setUpdateProductMediaVariants((input) => productService.updateProductMediaVariants(input));
const launchReadinessService = createLaunchReadinessService(platformDb.db, {
  listProducts: productService.listMerchantProducts,
});
const storefrontTemplateService = createStorefrontTemplateService(platformDb.db, {
  demoBaseUrl: storefrontDemoBaseUrl,
  getLaunchReadiness: launchReadinessService.getLaunchReadiness,
});
telegramRuntime.setCommerceTools({
  listMerchantOrders: async (input) => {
    const result = await orderService.listMerchantOrders({
      limit: input.limit,
      offset: input.offset,
      salesChannelId: input.salesChannelId,
    });
    if (!result.ok) return result;
    return { ok: true, orders: result.orders, count: result.count };
  },
  listMerchantProducts: (input) => productService.listMerchantProducts(input),
  updateMerchantProductVariantStock: (input) =>
    productService.updateMerchantProductVariantStock(input),
  createManualOrder: (input) =>
    manualOrderService.createManualOrder({
      ...input,
      note: input.note ?? null,
      shippingOptionId: input.shippingOptionId ?? null,
      customerId: input.customerId ?? null,
    }),
  ensureMerchantCustomer: async (input) => {
    const result = await customerService.ensureCustomer({
      email: input.email,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
      tenantId: input.tenantId,
    });
    if (!result.ok) return result;
    return {
      ok: true as const,
      customer: {
        id: result.customer.id,
        email: result.customer.email,
      },
    };
  },
});

const { chapaPaymentService, recheckMerchantOrderPayment } = createPaymentRuntime({
  billingProviderEventInbox,
  db: platformDb.db,
  env: process.env,
  orderService,
  recordAnalyticsEvent: analyticsService.recordAnalyticsEvent,
  recordNotificationEvent: notificationService.recordNotificationEvent,
});

const billingAppOptions = createBillingAppOptions({
  billingRuntime,
  chapaPaymentService,
  env: process.env,
  logger,
});

const { auth, googleAuthEnabled, googleAuthStatus, merchantTeamService } = createAuthRuntime({
  authEmailProvider,
  db: platformDb.db,
  emailDeliveryService,
  env: process.env,
  requireEmailVerification,
});
logger.info(
  { enabled: googleAuthEnabled, status: googleAuthStatus },
  "Google OAuth configuration resolved",
);

const app = createPlatformApp({
  landingPublicOrigins: parseTrustedOrigins(process.env.LANDING_PUBLIC_ORIGINS) ?? [
    "http://ecs.lvh.me:4322",
    "http://localhost:4322",
    "http://127.0.0.1:4322",
  ],
  dashboardPublicBaseUrl: process.env.DASHBOARD_PUBLIC_BASE_URL ?? "http://app.lvh.me",
  ...emailAppOptions,
  ...mediaAppOptions,
  ...platformOperationsAppOptions,
  ...commerceAppOptions,
  ...deliveryAppOptions,
  ...telegramRuntime.appOptions,
  merchantTeamService,
  createReviewedProductImportArtifact: productImportArtifactService.createReviewedArtifact,
  ...(productImportExecutionService
    ? {
        getProductImportExecution: productImportExecutionService.getExecution,
        requestProductImportApply: productImportExecutionService.requestApply,
      }
    : {}),
  getCustomerCommerceState: customerCommerceService.getState,
  updateCustomerCommerceState: customerCommerceService.updateState,
  createStorefrontInquiry: storefrontInquiryService.createInquiry,
  listStorefrontInquiries: storefrontInquiryService.listInquiries,
  getStorefrontInquiry: storefrontInquiryService.getInquiry,
  updateStorefrontInquiryStatus: storefrontInquiryService.updateInquiryStatus,
  logger,
  storefrontPreviewSecret: process.env.STOREFRONT_PREVIEW_SECRET?.trim(),
  authHandler: auth.handler,
  googleAuthEnabled,
  createTenantDomain: domainManagementService.createTenantDomain,
  createTenantShop,
  checkTenantHandleAvailability,
  ...billingAppOptions,
  getDashboardMetrics: dashboardMetricsService,
  getInsightsSales,
  getInsightsProducts,
  getInsightsDemand,
  getInsightsStorefront,
  listPlatformStorefrontTemplates: platformTemplateAssetService.listTemplates,
  createPlatformTemplatePreviewUpload: platformTemplateAssetService.createUpload,
  completePlatformTemplatePreviewUpload: platformTemplateAssetService.completeUpload,
  updatePlatformStorefrontTemplate: platformTemplateAssetService.updateTemplatePresentation,
  requestInsightsRefresh,
  getMerchantChapaCredentials: paymentOnboardingService.getMerchantChapaCredentials,
  isMerchantChapaConfigured: paymentOnboardingService.isMerchantChapaConfigured,
  getMerchantStorePaymentStatus: paymentOnboardingService.getMerchantStorePaymentStatus,
  setMerchantChapaSecret: paymentOnboardingService.setMerchantChapaSecret,
  setMerchantChapaOnlineEnabled: paymentOnboardingService.setMerchantChapaOnlineEnabled,
  clearMerchantChapaSecret: paymentOnboardingService.clearMerchantChapaSecret,
  handleChapaPaymentCallback: chapaPaymentService.handleChapaPaymentCallback,
  getOnboardingState,
  getPublishedStorefrontConfig: storefrontTemplateService.getPublishedStorefrontConfig,
  getStorefrontDraft: storefrontTemplateService.getStorefrontDraft,
  getStorefrontSeoSettings: storefrontTemplateService.getStorefrontSeoSettings,
  getTenantCommerceContext,
  getTenantDashboardSummary,
  getTenantForUser,
  getTenantInsightsSummary: analyticsInsightsService.getTenantInsightsSummary,
  ...(getStorefrontInsights ? { getStorefrontInsights } : {}),
  getTenantOnboarding: tenantOnboardingService.getTenantOnboarding,
  getTenantReadiness: tenantStatusService.getTenantReadiness,
  getSession: (headers) => auth.api.getSession({ headers }),
  recordMerchantDataExport,
  listNotificationPreferences: notificationService.listNotificationPreferences,
  listInAppNotifications: notificationService.inbox.list,
  countInAppNotificationUnread: notificationService.inbox.unreadCount,
  markInAppNotificationRead: notificationService.inbox.setRead,
  archiveInAppNotification: notificationService.inbox.archive,
  markAllInAppNotificationsRead: notificationService.inbox.markAllRead,
  markInAppNotificationsSeen: notificationService.inbox.markSeen,
  listTenantsForUser,
  getTenantMembershipSummary,
  listTenantProvisioningAttempts,
  listPaymentOnboarding: paymentOnboardingService.listPaymentOnboarding,
  listTenantDomains: domainManagementService.listTenantDomains,
  listStorefrontTemplates: storefrontTemplateService.listStorefrontTemplates,
  listMerchantReceivingAccounts: receivingAccountsService.listAccounts,
  createMerchantReceivingAccount: receivingAccountsService.createAccount,
  updateMerchantReceivingAccount: receivingAccountsService.updateAccount,
  deleteMerchantReceivingAccount: receivingAccountsService.deleteAccount,
  listMerchantPaymentBanks: receivingAccountsService.listBanks,
  recheckMerchantOrderPayment,
  publishStorefrontDraft: storefrontTemplateService.publishStorefrontDraft,
  getLaunchReadiness: launchReadinessService.getLaunchReadiness,
  confirmStorefrontReview: launchReadinessService.confirmStorefrontReview,
  unpublishStorefront: storefrontTemplateService.unpublishStorefront,
  recordAnalyticsEvent: analyticsService.recordAnalyticsEvent,
  ...(storefrontAnalyticsBridge
    ? { recordStorefrontBehavior: storefrontAnalyticsBridge.capture }
    : {}),
  recordNotificationEvent: notificationService.recordNotificationEvent,
  resolveTenantIdByMedusaSalesChannelId,
  sendTestNotification: notificationService.sendTestNotification,
  reviewPaymentOnboarding: paymentOnboardingService.reviewPaymentOnboarding,
  retryTenantShopProvisioningAttempt,
  verifyTenantDomainOwnership: domainManagementService.verifyTenantDomainOwnership,
  selectStorefrontTemplate: storefrontTemplateService.selectStorefrontTemplate,
  setTenantPrimaryDomain: domainManagementService.setTenantPrimaryDomain,
  submitPaymentOnboarding: paymentOnboardingService.submitPaymentOnboarding,
  updateTenantShopSettings,
  upsertNotificationPreference: notificationService.upsertNotificationPreference,
  updateStorefrontDraft: storefrontTemplateService.updateStorefrontDraft,
  updateStorefrontSeoSettings: storefrontTemplateService.updateStorefrontSeoSettings,
  updateTenantStatus: tenantStatusService.updateTenantStatus,
  serviceName: env.SERVICE_NAME,
  medusaInternalUrl,
  platformPublicBaseUrl,
  internalApiToken: platformInternalApiToken,
  resolveTenantForHost: (host) =>
    resolveTenantFromHost({
      host,
      platformBaseDomain,
      systemHosts: getSystemHosts(process.env),
      findDomainByHostname,
    }),
});

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const telegramPollingAbort = new AbortController();

telegramRuntime.startPolling(telegramPollingAbort.signal);

startPlatformServer({
  fetch: app.fetch,
  jobsClient,
  logger,
  onBeforeClose: () => telegramPollingAbort.abort(),
  platformDbPool: platformDb.pool,
  port,
});
