import type { createPlatformDb } from "@ecs/db";
import type { createLogger } from "@ecs/logger";
import { resolveMedusaAdminToken } from "../adapters/medusa/admin-token.js";
import { createMedusaCatalogTranslationService } from "../adapters/medusa/catalog-translation-service.js";
import { createMedusaCustomerService } from "../adapters/medusa/customer-service.js";
import { createMedusaManualOrderService } from "../adapters/medusa/manual-order-service.js";
import { createMedusaPromotionService } from "../adapters/medusa/promotion-service.js";
import { createMedusaOrderService } from "../modules/commerce/order-management.js";
import { createMedusaProductService } from "../modules/commerce/product-catalog.js";
import { withPaymentNotificationProjection } from "../modules/notifications/payment-aware-order-management.js";
import type { createNotificationService } from "../modules/notifications/service.js";
import { wrapProductServiceWithStorefrontPurge } from "../modules/storefront/catalog-cache-invalidation.js";

type CommerceBootstrapOptions = {
  db: ReturnType<typeof createPlatformDb>["db"];
  env: NodeJS.ProcessEnv;
  logger: ReturnType<typeof createLogger>;
  recordNotificationEvent: ReturnType<typeof createNotificationService>["recordNotificationEvent"];
  resolveTenantIdBySalesChannelId: (salesChannelId: string) => Promise<string | null>;
};

export async function createCommerceRuntime(options: CommerceBootstrapOptions) {
  const medusaInternalUrl = options.env.MEDUSA_INTERNAL_URL ?? "http://localhost:9000";
  const internalApiToken =
    options.env.PLATFORM_INTERNAL_API_TOKEN ??
    (options.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token");
  const tokenResult = await resolveMedusaAdminToken({
    db: options.db,
    medusaInternalUrl,
    internalApiToken,
    envToken: options.env.MEDUSA_ADMIN_API_TOKEN,
    logger: options.logger,
  });

  if (!tokenResult.ok) {
    options.logger.error(
      { error: tokenResult.error },
      "medusa_admin_token_unavailable — catalog and shop provisioning will fail until bootstrap succeeds",
    );
    if (options.env.NODE_ENV === "production") {
      throw new Error(`medusa_admin_token_unavailable:${tokenResult.error}`);
    }
  }
  const adminApiToken = tokenResult.ok
    ? tokenResult.token
    : (options.env.MEDUSA_ADMIN_API_TOKEN ?? "");

  if (tokenResult.ok) {
    options.logger.info(
      { source: tokenResult.source, fingerprint: adminApiToken.slice(-4) },
      "medusa_admin_token_ready",
    );
  }

  const baseOrderService = createMedusaOrderService({ adminApiToken, medusaInternalUrl });
  const orderService = withPaymentNotificationProjection(baseOrderService, {
    recordNotificationEvent: options.recordNotificationEvent,
    resolveTenantIdBySalesChannelId: options.resolveTenantIdBySalesChannelId,
  });
  const productService = wrapProductServiceWithStorefrontPurge(
    createMedusaProductService({ adminApiToken, medusaInternalUrl }),
    {
      resolveTenantIdBySalesChannelId: options.resolveTenantIdBySalesChannelId,
      logger: options.logger,
    },
  );

  return {
    catalogTranslationService: createMedusaCatalogTranslationService({
      adminApiToken,
      medusaInternalUrl,
    }),
    customerService: createMedusaCustomerService({ adminApiToken, medusaInternalUrl }),
    manualOrderService: createMedusaManualOrderService({ adminApiToken, medusaInternalUrl }),
    medusaInternalUrl,
    orderService,
    productService,
    promotionService: createMedusaPromotionService({ adminApiToken, medusaInternalUrl }),
  };
}
