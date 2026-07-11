import { loadServiceEnv } from "@ecs/config";
import { createPlatformDb } from "@ecs/db";
import { createLogger } from "@ecs/logger";
import { serve } from "@hono/node-server";
import { createChapaPaymentService } from "./adapters/chapa/payment-service.js";
import { createMedusaCommerceProvisioningClient } from "./adapters/medusa/commerce-provisioning.js";
import { createPlatformApp } from "./app.js";
import { loadPlatformApiEnvFiles } from "./config/env.js";
import { getSystemHosts } from "./config/hosts.js";
import { createDashboardAuthorizationLookup } from "./context/dashboard-authorization.js";
import { createDomainTenantLookup } from "./context/domain-tenant-lookup.js";
import { createPlatformAuth, parseTrustedOrigins } from "./context/platform-auth.js";
import { resolveTenantFromHost } from "./context/tenant-resolver.js";
import {
  createAnalyticsInsightsService,
  createAnalyticsService,
  createDrizzleAnalyticsEventStore,
  createDrizzleAnalyticsInsightsStore,
} from "./modules/analytics/analytics-service.js";
import { createDashboardMetricsService } from "./modules/analytics/dashboard-metrics-service.js";
import { createBillingService } from "./modules/billing/service.js";
import { createMedusaOrderService } from "./modules/commerce/order-management.js";
import { createMedusaProductService } from "./modules/commerce/product-catalog.js";
import { createDeliverySettingsService } from "./modules/delivery/service.js";
import { createDomainManagementService } from "./modules/domains/service.js";
import { createNotificationService } from "./modules/notifications/service.js";
import { createTenantOnboardingService } from "./modules/onboarding/service.js";
import { createPaymentOnboardingService } from "./modules/payments/payment-onboarding-service.js";
import { createStorefrontTemplateService } from "./modules/storefront/template-service.js";
import { createSupportService } from "./modules/support/service.js";
import {
  createTenantCommerceContextService,
  createTenantDashboardSummaryService,
} from "./modules/tenants/commerce-context-service.js";
import {
  createPlatformOnboardingStateService,
  createTenantDetailService,
  createTenantHandleAvailabilityService,
  createTenantListService,
  createTenantShopSettingsService,
} from "./modules/tenants/list-service.js";
import {
  createTenantProvisioningAttemptListService,
  createTenantShopProvisioningRetryServiceFromDb,
  createTenantShopProvisioningService,
} from "./modules/tenants/shop-provisioning.js";
import { createTenantStatusService } from "./modules/tenants/status-service.js";

loadPlatformApiEnvFiles();

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
    process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5432/platform_db",
  max: Number.parseInt(process.env.PLATFORM_DATABASE_POOL_MAX ?? "5", 10),
  idleTimeoutMillis: Number.parseInt(
    process.env.PLATFORM_DATABASE_POOL_IDLE_TIMEOUT_MS ?? "30000",
    10,
  ),
});
const findDomainByHostname = createDomainTenantLookup(platformDb.db);
const billingService = createBillingService(platformDb.db);
const deliverySettingsService = createDeliverySettingsService(platformDb.db);
const domainManagementService = createDomainManagementService(platformDb.db);
const notificationService = createNotificationService(platformDb.db);
const analyticsService = createAnalyticsService(createDrizzleAnalyticsEventStore(platformDb.db));
const analyticsInsightsService = createAnalyticsInsightsService(
  createDrizzleAnalyticsInsightsStore(platformDb.db),
);
const dashboardMetricsService = createDashboardMetricsService(platformDb.db);
const authorizeDashboardForTenant = createDashboardAuthorizationLookup(platformDb.db);
const storefrontTemplateService = createStorefrontTemplateService(platformDb.db);
const supportService = createSupportService(platformDb.db);
const tenantOnboardingService = createTenantOnboardingService(platformDb.db);
const getTenantCommerceContext = createTenantCommerceContextService(platformDb.db);
const getTenantDashboardSummary = createTenantDashboardSummaryService(platformDb.db);
const getTenantForUser = createTenantDetailService(platformDb.db);
const listTenantsForUser = createTenantListService(platformDb.db);
const tenantStatusService = createTenantStatusService(platformDb.db);
const paymentOnboardingService = createPaymentOnboardingService(platformDb.db);
const chapaPaymentService = createChapaPaymentService({
  apiUrl: process.env.CHAPA_API_URL,
  recordAnalyticsEvent: analyticsService.recordAnalyticsEvent,
  recordNotificationEvent: notificationService.recordNotificationEvent,
  secretKey: process.env.CHAPA_SECRET_KEY,
});
const medusaInternalUrl = process.env.MEDUSA_INTERNAL_URL ?? "http://localhost:9000";
const platformPublicBaseUrl =
  process.env.PLATFORM_PUBLIC_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://api.lvh.me";
const platformBaseDomain = process.env.STOREFRONT_PUBLIC_BASE_DOMAIN ?? "lvh.me";
const updateTenantShopSettings = createTenantShopSettingsService({
  db: platformDb.db,
  platformBaseDomain,
});
const checkTenantHandleAvailability = createTenantHandleAvailabilityService({
  db: platformDb.db,
  platformBaseDomain,
});
const getOnboardingState = createPlatformOnboardingStateService({
  db: platformDb.db,
  listTenantsForUser,
});
const platformInternalApiToken =
  process.env.PLATFORM_INTERNAL_API_TOKEN ??
  (process.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token");
const provisionCommerceResources = createMedusaCommerceProvisioningClient({
  internalApiToken: platformInternalApiToken,
  medusaInternalUrl,
});
const createTenantShop = createTenantShopProvisioningService({
  db: platformDb.db,
  platformBaseDomain,
  provisionCommerceResources,
  recordAnalyticsEvent: analyticsService.recordAnalyticsEvent,
});
const retryTenantShopProvisioningAttempt = createTenantShopProvisioningRetryServiceFromDb({
  createTenantShop,
  db: platformDb.db,
});
const listTenantProvisioningAttempts = createTenantProvisioningAttemptListService(platformDb.db);
const orderService = createMedusaOrderService({
  adminApiToken: process.env.MEDUSA_ADMIN_API_TOKEN,
  medusaInternalUrl,
});
const productService = createMedusaProductService({
  adminApiToken: process.env.MEDUSA_ADMIN_API_TOKEN,
  medusaInternalUrl,
});
const auth = createPlatformAuth({
  baseUrl: process.env.BETTER_AUTH_URL ?? "http://api.lvh.me",
  cookieDomain: process.env.BETTER_AUTH_COOKIE_DOMAIN,
  db: platformDb.db,
  secret:
    process.env.BETTER_AUTH_SECRET ?? "development-better-auth-secret-change-before-production",
  trustedOrigins: parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS) ?? [
    "http://api.lvh.me",
    "http://dashboard.lvh.me",
  ],
  useSecureCookies: (process.env.BETTER_AUTH_URL ?? "http://api.lvh.me").startsWith("https://"),
});

const app = createPlatformApp({
  authHandler: auth.handler,
  authorizeDashboardForTenant,
  createOperatorSupportNote: supportService.createOperatorSupportNote,
  createMerchantProduct: productService.createMerchantProduct,
  createMerchantProductCategory: productService.createMerchantProductCategory,
  createMerchantProductCollection: productService.createMerchantProductCollection,
  deleteMerchantProduct: productService.deleteMerchantProduct,
  deleteMerchantProductsBatch: productService.deleteMerchantProductsBatch,
  deleteMerchantProductCategory: productService.deleteMerchantProductCategory,
  deleteMerchantProductCategoriesBatch: productService.deleteMerchantProductCategoriesBatch,
  deleteMerchantProductCollection: productService.deleteMerchantProductCollection,
  deleteMerchantProductCollectionsBatch: productService.deleteMerchantProductCollectionsBatch,
  createTenantDomain: domainManagementService.createTenantDomain,
  createTenantShop,
  checkTenantHandleAvailability,
  getBillingStatus: billingService.getBillingStatus,
  getDashboardMetrics: dashboardMetricsService,
  getDeliverySettings: deliverySettingsService.getDeliverySettings,
  handleChapaPaymentCallback: chapaPaymentService.handleChapaPaymentCallback,
  getOperatorSupportHistory: supportService.getOperatorSupportHistory,
  getOnboardingState,
  getPublishedStorefrontConfig: storefrontTemplateService.getPublishedStorefrontConfig,
  getStorefrontDraft: storefrontTemplateService.getStorefrontDraft,
  getTenantCommerceContext,
  getTenantDashboardSummary,
  getTenantForUser,
  getTenantInsightsSummary: analyticsInsightsService.getTenantInsightsSummary,
  getTenantOnboarding: tenantOnboardingService.getTenantOnboarding,
  getTenantReadiness: tenantStatusService.getTenantReadiness,
  getMerchantOrder: orderService.getMerchantOrder,
  getMerchantProduct: productService.getMerchantProduct,
  getMerchantProductStock: productService.getMerchantProductStock,
  getMerchantProductVariantStock: productService.getMerchantProductVariantStock,
  getSession: (headers) => auth.api.getSession({ headers }),
  listMerchantOrders: orderService.listMerchantOrders,
  listMerchantProducts: productService.listMerchantProducts,
  listMerchantProductCategories: productService.listMerchantProductCategories,
  listMerchantProductCollections: productService.listMerchantProductCollections,
  listNotificationPreferences: notificationService.listNotificationPreferences,
  listTenantsForUser,
  listTenantProvisioningAttempts,
  listPaymentOnboarding: paymentOnboardingService.listPaymentOnboarding,
  listTenantDomains: domainManagementService.listTenantDomains,
  listStorefrontTemplates: storefrontTemplateService.listStorefrontTemplates,
  mutateMerchantOrder: orderService.mutateMerchantOrder,
  publishStorefrontDraft: storefrontTemplateService.publishStorefrontDraft,
  recordAnalyticsEvent: analyticsService.recordAnalyticsEvent,
  recordNotificationEvent: notificationService.recordNotificationEvent,
  reviewPaymentOnboarding: paymentOnboardingService.reviewPaymentOnboarding,
  retryTenantShopProvisioningAttempt,
  selectStorefrontTemplate: storefrontTemplateService.selectStorefrontTemplate,
  setTenantPrimaryDomain: domainManagementService.setTenantPrimaryDomain,
  submitPaymentOnboarding: paymentOnboardingService.submitPaymentOnboarding,
  updateBillingInvoiceStatus: billingService.updateBillingInvoiceStatus,
  updateDeliverySettings: deliverySettingsService.updateDeliverySettings,
  updateTenantShopSettings,
  updateMerchantProduct: productService.updateMerchantProduct,
  updateMerchantProductStock: productService.updateMerchantProductStock,
  updateMerchantProductVariantStock: productService.updateMerchantProductVariantStock,
  upsertNotificationPreference: notificationService.upsertNotificationPreference,
  updateStorefrontDraft: storefrontTemplateService.updateStorefrontDraft,
  updateTenantStatus: tenantStatusService.updateTenantStatus,
  serviceName: env.SERVICE_NAME,
  medusaInternalUrl,
  platformPublicBaseUrl,
  resolveTenantForHost: (host) =>
    resolveTenantFromHost({
      host,
      platformBaseDomain,
      systemHosts: getSystemHosts(process.env),
      findDomainByHostname,
    }),
});

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    logger.info({ port: info.port }, "platform api listening");
  },
);
