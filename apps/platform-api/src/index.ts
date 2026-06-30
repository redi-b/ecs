import { loadServiceEnv } from "@ecs/config";
import { createPlatformDb } from "@ecs/db";
import { createLogger } from "@ecs/logger";
import { serve } from "@hono/node-server";
import {
  createAnalyticsService,
  createDrizzleAnalyticsEventStore,
} from "./analytics/analytics-service.js";
import { createPlatformApp } from "./app.js";
import { createDashboardAuthorizationLookup } from "./auth/dashboard-authorization.js";
import { createPlatformAuth, parseTrustedOrigins } from "./auth/platform-auth.js";
import { createBillingService } from "./billing/billing-service.js";
import { createMedusaOrderService } from "./commerce/order-service.js";
import { createMedusaProductService } from "./commerce/product-service.js";
import { getSystemHosts } from "./config/hosts.js";
import { createDeliverySettingsService } from "./delivery/delivery-service.js";
import { createDomainManagementService } from "./domains/domain-service.js";
import { createNotificationService } from "./notifications/notification-service.js";
import { createTenantOnboardingService } from "./onboarding/onboarding-service.js";
import { createChapaPaymentService } from "./payments/chapa-payment-service.js";
import { createPaymentOnboardingService } from "./payments/payment-onboarding-service.js";
import { createMedusaCommerceProvisioningClient } from "./provisioning/medusa-commerce-provisioning.js";
import { createTenantShopProvisioningService } from "./provisioning/tenant-shop-provisioning.js";
import { createStorefrontTemplateService } from "./storefront/template-service.js";
import { createSupportService } from "./support/support-service.js";
import { createDomainTenantLookup } from "./tenancy/domain-tenant-lookup.js";
import { resolveTenantFromHost } from "./tenancy/tenant-resolver.js";
import { createTenantStatusService } from "./tenants/tenant-status-service.js";

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
const authorizeDashboardForTenant = createDashboardAuthorizationLookup(platformDb.db);
const storefrontTemplateService = createStorefrontTemplateService(platformDb.db);
const supportService = createSupportService(platformDb.db);
const tenantOnboardingService = createTenantOnboardingService(platformDb.db);
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
const provisionCommerceResources = createMedusaCommerceProvisioningClient({
  internalApiToken: process.env.PLATFORM_INTERNAL_API_TOKEN,
  medusaInternalUrl,
});
const createTenantShop = createTenantShopProvisioningService({
  db: platformDb.db,
  platformBaseDomain,
  provisionCommerceResources,
  recordAnalyticsEvent: analyticsService.recordAnalyticsEvent,
});
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
  db: platformDb.db,
  secret:
    process.env.BETTER_AUTH_SECRET ?? "development-better-auth-secret-change-before-production",
  trustedOrigins: parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS) ?? [
    "http://abebe.lvh.me",
    "http://api.lvh.me",
    "http://dashboard.lvh.me",
  ],
});

const app = createPlatformApp({
  authHandler: auth.handler,
  authorizeDashboardForTenant,
  createOperatorSupportNote: supportService.createOperatorSupportNote,
  createMerchantProduct: productService.createMerchantProduct,
  createTenantDomain: domainManagementService.createTenantDomain,
  createTenantShop,
  getBillingStatus: billingService.getBillingStatus,
  getDeliverySettings: deliverySettingsService.getDeliverySettings,
  handleChapaPaymentCallback: chapaPaymentService.handleChapaPaymentCallback,
  getOperatorSupportHistory: supportService.getOperatorSupportHistory,
  getPublishedStorefrontConfig: storefrontTemplateService.getPublishedStorefrontConfig,
  getStorefrontDraft: storefrontTemplateService.getStorefrontDraft,
  getTenantOnboarding: tenantOnboardingService.getTenantOnboarding,
  getSession: (headers) => auth.api.getSession({ headers }),
  listMerchantOrders: orderService.listMerchantOrders,
  listMerchantProducts: productService.listMerchantProducts,
  listNotificationPreferences: notificationService.listNotificationPreferences,
  listPaymentOnboarding: paymentOnboardingService.listPaymentOnboarding,
  listTenantDomains: domainManagementService.listTenantDomains,
  listStorefrontTemplates: storefrontTemplateService.listStorefrontTemplates,
  publishStorefrontDraft: storefrontTemplateService.publishStorefrontDraft,
  recordAnalyticsEvent: analyticsService.recordAnalyticsEvent,
  recordNotificationEvent: notificationService.recordNotificationEvent,
  reviewPaymentOnboarding: paymentOnboardingService.reviewPaymentOnboarding,
  selectStorefrontTemplate: storefrontTemplateService.selectStorefrontTemplate,
  setTenantPrimaryDomain: domainManagementService.setTenantPrimaryDomain,
  submitPaymentOnboarding: paymentOnboardingService.submitPaymentOnboarding,
  updateBillingInvoiceStatus: billingService.updateBillingInvoiceStatus,
  updateDeliverySettings: deliverySettingsService.updateDeliverySettings,
  updateMerchantProduct: productService.updateMerchantProduct,
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
