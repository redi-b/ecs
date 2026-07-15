import { loadServiceEnv } from "@ecs/config";
import { createPlatformDb, tenants } from "@ecs/db";
import { createJobsClient } from "@ecs/jobs";
import { createLogger } from "@ecs/logger";
import { serve } from "@hono/node-server";
import { eq } from "drizzle-orm";
import {
  createChapaPaymentService,
  resolveChapaPayerEmail,
} from "./adapters/chapa/payment-service.js";
import { createMedusaCommerceProvisioningClient } from "./adapters/medusa/commerce-provisioning.js";
import { createMedusaCustomerService } from "./adapters/medusa/customer-service.js";
import { createMedusaManualOrderService } from "./adapters/medusa/manual-order-service.js";
import { createMedusaPromotionService } from "./adapters/medusa/promotion-service.js";
import { createMediaStorageFromEnv } from "./adapters/storage/index.js";
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
import { reconcileChapaBillingPayments } from "./modules/billing/reconcile-payments.js";
import { createBillingService, isPlatformBillingTxRef } from "./modules/billing/service.js";
import { createMedusaOrderService } from "./modules/commerce/order-management.js";
import { createMedusaProductService } from "./modules/commerce/product-catalog.js";
import { createDeliverySettingsService } from "./modules/delivery/service.js";
import { createDomainManagementService } from "./modules/domains/service.js";
import { createMediaService } from "./modules/media/index.js";
import { isEmailDeliveryConfigured } from "./modules/notifications/providers/email-provider.js";
import { createNotificationService } from "./modules/notifications/service.js";
import { createTelegramConnectService } from "./modules/notifications/telegram-connect.js";
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
import { createResolveTenantIdByMedusaSalesChannel } from "./modules/tenants/resolve-by-medusa-sales-channel.js";
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
const mediaStorage = createMediaStorageFromEnv();
if (mediaStorage.provider === "unconfigured") {
  logger.warn("Media storage is not configured; upload routes will return 503.");
} else {
  logger.info(
    { bucket: mediaStorage.bucket, provider: mediaStorage.provider },
    "Media storage configured.",
  );
}
const mediaService = createMediaService(platformDb.db, mediaStorage);

const redisUrl = process.env.REDIS_URL?.trim();
const jobsClient = redisUrl
  ? createJobsClient({
      redisUrl,
      db: platformDb.db,
      logger,
    })
  : null;
if (!jobsClient) {
  logger.warn("REDIS_URL is not set; notification delivery jobs will not be enqueued.");
}

const notificationService = createNotificationService(platformDb.db, {
  ...(jobsClient
    ? {
        enqueueJob: (input) => jobsClient.enqueueJob(input),
      }
    : {}),
});

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME?.trim() || "";
const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";
const telegramConnectService = createTelegramConnectService(
  platformDb.db,
  telegramBotToken && telegramBotUsername
    ? { botToken: telegramBotToken, botUsername: telegramBotUsername }
    : null,
);
if (telegramConnectService.isConfigured()) {
  logger.info({ bot: telegramBotUsername }, "Telegram bot configured for notifications.");
} else {
  logger.warn("TELEGRAM_BOT_TOKEN/USERNAME not set; Telegram connect stays unavailable.");
}

const emailDeliveryConfigured = isEmailDeliveryConfigured(process.env);
if (emailDeliveryConfigured) {
  logger.info({ from: process.env.EMAIL_FROM?.trim() }, "Email delivery configured (Resend).");
} else {
  logger.warn("RESEND_API_KEY/EMAIL_FROM not set; email delivery stays unavailable in the dashboard.");
}

const notificationChannelAvailability = {
  email: emailDeliveryConfigured,
  telegram: telegramConnectService.isConfigured(),
};
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
const medusaInternalUrl = process.env.MEDUSA_INTERNAL_URL ?? "http://localhost:9000";
const customerService = createMedusaCustomerService({
  adminApiToken: process.env.MEDUSA_ADMIN_API_TOKEN,
  medusaInternalUrl,
});
const promotionService = createMedusaPromotionService({
  adminApiToken: process.env.MEDUSA_ADMIN_API_TOKEN,
  medusaInternalUrl,
});
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
const manualOrderService = createMedusaManualOrderService({
  adminApiToken: process.env.MEDUSA_ADMIN_API_TOKEN,
  medusaInternalUrl,
});
const productService = createMedusaProductService({
  adminApiToken: process.env.MEDUSA_ADMIN_API_TOKEN,
  medusaInternalUrl,
});

async function resolveTenantSalesChannelId(tenantId: string) {
  const [row] = await platformDb.db
    .select({ medusaSalesChannelId: tenants.medusaSalesChannelId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row?.medusaSalesChannelId?.trim() || null;
}

const chapaPaymentService = createChapaPaymentService({
  apiUrl: process.env.CHAPA_API_URL,
  onVerifiedSuccess: async ({ providerReference, tenantId, txRef }) => {
    // Platform subscription invoices use ecs_bill_* tx_refs (never Medusa order refs).
    if (isPlatformBillingTxRef(txRef)) {
      await billingService.completeChapaInvoicePayment({
        providerReference: providerReference ?? null,
        tenantId,
        txRef,
      });
      return;
    }

    const salesChannelId = await resolveTenantSalesChannelId(tenantId);
    if (!salesChannelId) {
      return;
    }
    await orderService.capturePaymentByTxRef({
      salesChannelId,
      source: "chapa_webhook",
      txRef,
    });
  },
  recordAnalyticsEvent: analyticsService.recordAnalyticsEvent,
  recordNotificationEvent: notificationService.recordNotificationEvent,
  secretKey: process.env.CHAPA_SECRET_KEY,
});

async function recheckMerchantOrderPayment(input: {
  orderId: string;
  salesChannelId: string;
  tenantId: string;
}) {
  const existing = await orderService.getMerchantOrder({
    orderId: input.orderId,
    salesChannelId: input.salesChannelId,
  });
  if (!existing.ok) {
    return existing;
  }

  const txRef = existing.order.paymentReference?.trim();
  if (!txRef) {
    return {
      ok: false as const,
      error: "order_not_fulfillable" as const,
      status: 409 as const,
    };
  }

  let verification: Awaited<ReturnType<typeof chapaPaymentService.verifyPayment>>;
  try {
    verification = await chapaPaymentService.verifyPayment(txRef);
  } catch {
    return {
      ok: false as const,
      error: "commerce_backend_unavailable" as const,
      status: 503 as const,
    };
  }

  if (!verification) {
    return {
      ok: false as const,
      error: "order_not_found" as const,
      status: 404 as const,
    };
  }

  const status = (
    typeof verification.data?.status === "string"
      ? verification.data.status
      : typeof verification.status === "string"
        ? verification.status
        : ""
  )
    .trim()
    .toLowerCase();

  if (status !== "success") {
    return {
      ok: false as const,
      error: "order_not_fulfillable" as const,
      status: 409 as const,
    };
  }

  return orderService.markMerchantOrderPaid({
    orderId: input.orderId,
    paymentReference: txRef,
    salesChannelId: input.salesChannelId,
    source: "chapa_recheck",
  });
}
const auth = createPlatformAuth({
  baseUrl: process.env.BETTER_AUTH_URL ?? "http://api.lvh.me",
  cookieDomain: process.env.BETTER_AUTH_COOKIE_DOMAIN,
  db: platformDb.db,
  secret:
    process.env.BETTER_AUTH_SECRET ?? "development-better-auth-secret-change-before-production",
  trustedOrigins: parseTrustedOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS) ?? [
    "http://api.lvh.me",
    "http://dashboard.lvh.me",
    // Tenant dashboards (shop subdomains) call /platform/auth from the browser origin.
    "http://*.lvh.me",
    "http://*.lvh.me:3001",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ],
  useSecureCookies: (process.env.BETTER_AUTH_URL ?? "http://api.lvh.me").startsWith("https://"),
});

const app = createPlatformApp({
  logger,
  createMerchantPromotion: promotionService.createPromotion,
  authHandler: auth.handler,
  authorizeDashboardForTenant,
  createOperatorSupportNote: supportService.createOperatorSupportNote,
  createMerchantProduct: productService.createMerchantProduct,
  createMerchantProductCategory: productService.createMerchantProductCategory,
  createMerchantProductCollection: productService.createMerchantProductCollection,
  createMediaUpload: mediaService.createUpload,
  createMerchantCustomer: customerService.createCustomer,
  ensureMerchantCustomer: customerService.ensureCustomer,
  createMerchantCustomerAddress: customerService.createCustomerAddress,
  deleteMerchantCustomerAddress: customerService.deleteCustomerAddress,
  deleteMerchantPromotion: promotionService.deletePromotion,
  completeMediaUpload: mediaService.completeUpload,
  deleteMediaAsset: mediaService.deleteMedia,
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
  createPlanUpgradeInvoice: billingService.createPlanUpgradeInvoice,
  schedulePlanDowngrade: billingService.schedulePlanDowngrade,
  cancelScheduledPlanDowngrade: billingService.cancelScheduledPlanDowngrade,
  confirmBillingPayments: async (input) => {
    const pending = await billingService.listPendingChapaInvoiceTxRefs(input);
    const result = await reconcileChapaBillingPayments({
      items: pending,
      verifyPayment: (txRef) => chapaPaymentService.verifyPayment(txRef),
      completePayment: (payload) => billingService.completeChapaInvoicePayment(payload),
    });
    return { ok: true as const, confirmed: result.confirmed, checked: result.checked };
  },
  initializeBillingInvoicePayment: async (input) => {
    if (!process.env.CHAPA_SECRET_KEY?.trim()) {
      return {
        ok: false as const,
        error: "billing_chapa_unavailable" as const,
        status: 503 as const,
      };
    }
    // Demo shop emails are often *.local — Chapa rejects those (validation.email).
    const email = resolveChapaPayerEmail(
      input.payerEmail,
      process.env.CHAPA_FALLBACK_EMAIL ?? process.env.EMAIL_FROM,
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

    // If a prior Chapa attempt already succeeded but callback never applied, complete it.
    const pendingRefs = await billingService.listPendingChapaInvoiceTxRefs({
      tenantId: input.tenantId,
    });
    const prior = pendingRefs.find((row) => row.invoiceId === input.invoiceId);
    if (prior) {
      try {
        const verification = await chapaPaymentService.verifyPayment(prior.txRef);
        const status = String(verification?.data?.status ?? verification?.status ?? "")
          .trim()
          .toLowerCase();
        if (status === "success") {
          await billingService.completeChapaInvoicePayment({
            tenantId: input.tenantId,
            txRef: prior.txRef,
            providerReference:
              (typeof verification?.data?.ref_id === "string" && verification.data.ref_id) ||
              (typeof verification?.data?.reference === "string" &&
                verification.data.reference) ||
              prior.txRef,
          });
          const statusResult = await billingService.getBillingStatus({
            tenantId: input.tenantId,
          });
          const paidInvoice =
            statusResult.ok
              ? statusResult.billing.invoices.find((inv) => inv.id === input.invoiceId)
              : null;
          return {
            ok: true as const,
            // No new checkout — payment already captured; client should refresh.
            checkoutUrl: input.returnUrl,
            txRef: prior.txRef,
            invoice: paidInvoice ?? {
              id: input.invoiceId,
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
        // Fall through to a new initialize with a fresh tx_ref.
      }
    }

    const prepared = await billingService.prepareInvoiceForChapaPayment({
      invoiceId: input.invoiceId,
      tenantId: input.tenantId,
    });
    if (!prepared.ok) {
      return prepared;
    }

    const platformPublic =
      process.env.PLATFORM_PUBLIC_BASE_URL?.trim() ||
      process.env.BETTER_AUTH_URL?.trim() ||
      "http://api.lvh.me";
    const callbackUrl = new URL("/platform/payments/chapa/callback", platformPublic);
    callbackUrl.searchParams.set("tenant_id", input.tenantId);
    callbackUrl.searchParams.set("tx_ref", prepared.txRef);

    try {
      const init = await chapaPaymentService.initializePayment({
        amount: prepared.amount,
        callbackUrl: callbackUrl.toString(),
        currency: prepared.currency,
        description: "Growth plan",
        email,
        returnUrl: input.returnUrl,
        title: "ECS Billing",
        txRef: prepared.txRef,
      });

      return {
        ok: true as const,
        checkoutUrl: init.checkoutUrl,
        txRef: init.txRef,
        invoice: prepared.invoice,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Chapa payment initialization failed.";
      logger.warn(
        {
          err: message,
          invoiceId: input.invoiceId,
          tenantId: input.tenantId,
        },
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
  createMerchantManualOrder: manualOrderService.createManualOrder,
  getMerchantCustomer: customerService.getCustomer,
  getMerchantProduct: productService.getMerchantProduct,
  getMerchantProductStock: productService.getMerchantProductStock,
  getMerchantProductVariantStock: productService.getMerchantProductVariantStock,
  getSession: (headers) => auth.api.getSession({ headers }),
  listMerchantOrders: orderService.listMerchantOrders,
  listMerchantCustomers: customerService.listCustomers,
  listMerchantPromotions: promotionService.listPromotions,
  listMerchantCustomerGroups: customerService.listGroups,
  listMerchantProducts: productService.listMerchantProducts,
  listMerchantProductCategories: productService.listMerchantProductCategories,
  listMerchantProductCollections: productService.listMerchantProductCollections,
  listMediaAssets: mediaService.listMedia,
  syncProductMedia: mediaService.syncProductMedia,
  listNotificationPreferences: notificationService.listNotificationPreferences,
  listInAppNotifications: notificationService.inbox.list,
  countInAppNotificationUnread: notificationService.inbox.unreadCount,
  markInAppNotificationRead: notificationService.inbox.markRead,
  markAllInAppNotificationsRead: notificationService.inbox.markAllRead,
  notificationChannelAvailability,
  listTenantsForUser,
  listTenantProvisioningAttempts,
  listPaymentOnboarding: paymentOnboardingService.listPaymentOnboarding,
  listTenantDomains: domainManagementService.listTenantDomains,
  listStorefrontTemplates: storefrontTemplateService.listStorefrontTemplates,
  mutateMerchantOrder: orderService.mutateMerchantOrder,
  recheckMerchantOrderPayment,
  captureOrderPaymentByTxRef: orderService.capturePaymentByTxRef,
  publishStorefrontDraft: storefrontTemplateService.publishStorefrontDraft,
  recordAnalyticsEvent: analyticsService.recordAnalyticsEvent,
  recordNotificationEvent: notificationService.recordNotificationEvent,
  resolveTenantIdByMedusaSalesChannelId: createResolveTenantIdByMedusaSalesChannel(
    platformDb.db,
  ),
  sendTestNotification: notificationService.sendTestNotification,
  listTelegramDestinations: telegramConnectService.listDestinations,
  createTelegramConnectSession: telegramConnectService.createConnectSession,
  getTelegramConnectSession: telegramConnectService.getConnectSession,
  cancelTelegramConnectSession: telegramConnectService.cancelConnectSession,
  removeTelegramDestination: telegramConnectService.removeDestination,
  setTelegramDestinationEnabled: telegramConnectService.setDestinationEnabled,
  setTelegramSharedEvents: telegramConnectService.setSharedEvents,
  handleTelegramWebhook: telegramConnectService.handleWebhookUpdate,
  telegramWebhookSecret: telegramWebhookSecret || undefined,
  reviewPaymentOnboarding: paymentOnboardingService.reviewPaymentOnboarding,
  retryTenantShopProvisioningAttempt,
  selectStorefrontTemplate: storefrontTemplateService.selectStorefrontTemplate,
  setTenantPrimaryDomain: domainManagementService.setTenantPrimaryDomain,
  submitPaymentOnboarding: paymentOnboardingService.submitPaymentOnboarding,
  updateBillingInvoiceStatus: billingService.updateBillingInvoiceStatus,
  updateDeliverySettings: deliverySettingsService.updateDeliverySettings,
  updateTenantShopSettings,
  updateMerchantProduct: productService.updateMerchantProduct,
  listMerchantCollectionProducts: productService.listMerchantCollectionProducts,
  reorderMerchantProductCategories: productService.reorderMerchantProductCategories,
  updateMerchantCollectionProducts: productService.updateMerchantCollectionProducts,
  updateMerchantProductCategory: productService.updateMerchantProductCategory,
  updateMerchantProductCollection: productService.updateMerchantProductCollection,
  updateMerchantCustomer: customerService.updateCustomer,
  updateMerchantCustomerAddress: customerService.updateCustomerAddress,
  updateMerchantPromotion: promotionService.updatePromotion,
  updateMerchantProductStock: productService.updateMerchantProductStock,
  updateMerchantProductVariantStock: productService.updateMerchantProductVariantStock,
  updateMediaMetadata: mediaService.updateMetadata,
  upsertNotificationPreference: notificationService.upsertNotificationPreference,
  updateStorefrontDraft: storefrontTemplateService.updateStorefrontDraft,
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

async function shutdown(signal: string) {
  logger.info({ signal }, "platform api shutting down");
  try {
    if (jobsClient) {
      await jobsClient.close();
    }
    await platformDb.pool.end();
  } catch (error) {
    logger.error({ err: error }, "error during platform api shutdown");
    process.exit(1);
  }
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    logger.info({ port: info.port }, "platform api listening");
  },
);
