import type { createPlatformDb } from "@ecs/db";
import { createMedusaCommerceProvisioningClient } from "../adapters/medusa/commerce-provisioning.js";
import {
  createMedusaEnsurePickupOptionClient,
  createMedusaShippingPriceClient,
} from "../adapters/medusa/update-shipping-price.js";
import type { createAnalyticsService } from "../modules/analytics/analytics-service.js";
import { createSuperadminWorkRecoveryService } from "../modules/superadmin/work-recovery-service.js";
import {
  createPlatformOnboardingStateService,
  createTenantHandleAvailabilityService,
  createTenantShopSettingsService,
} from "../modules/tenants/list-service.js";
import { createResolveTenantIdByMedusaSalesChannel } from "../modules/tenants/resolve-by-medusa-sales-channel.js";
import {
  createTenantProvisioningAttemptListService,
  createTenantShopProvisioningRetryServiceFromDb,
  createTenantShopProvisioningService,
} from "../modules/tenants/shop-provisioning.js";

type TenantRuntimeOptions = {
  db: ReturnType<typeof createPlatformDb>["db"];
  internalApiToken: string | undefined;
  platformBaseDomain: string;
  listTenantsForUser: ReturnType<
    typeof import("../modules/tenants/list-service.js").createTenantListService
  >;
  medusaInternalUrl: string;
  recordAnalyticsEvent: ReturnType<typeof createAnalyticsService>["recordAnalyticsEvent"];
};

export function createTenantRuntime(options: TenantRuntimeOptions) {
  const clientOptions = {
    internalApiToken: options.internalApiToken,
    medusaInternalUrl: options.medusaInternalUrl,
  };

  const updateTenantShopSettings = createTenantShopSettingsService({
    db: options.db,
    platformBaseDomain: options.platformBaseDomain,
  });
  const checkTenantHandleAvailability = createTenantHandleAvailabilityService({
    db: options.db,
    platformBaseDomain: options.platformBaseDomain,
  });
  const getOnboardingState = createPlatformOnboardingStateService({
    db: options.db,
    listTenantsForUser: options.listTenantsForUser,
  });
  const createTenantShop = createTenantShopProvisioningService({
    db: options.db,
    platformBaseDomain: options.platformBaseDomain,
    provisionCommerceResources: createMedusaCommerceProvisioningClient(clientOptions),
    recordAnalyticsEvent: options.recordAnalyticsEvent,
  });

  return {
    checkTenantHandleAvailability,
    createTenantShop,
    ensureTenantPickupOption: createMedusaEnsurePickupOptionClient(clientOptions),
    getOnboardingState,
    listTenantProvisioningAttempts: createTenantProvisioningAttemptListService(options.db),
    recoverSuperadminWork: createSuperadminWorkRecoveryService({
      createTenantShop,
      db: options.db,
    }),
    resolveTenantIdByMedusaSalesChannelId: createResolveTenantIdByMedusaSalesChannel(options.db),
    retryTenantShopProvisioningAttempt: createTenantShopProvisioningRetryServiceFromDb({
      createTenantShop,
      db: options.db,
    }),
    updateTenantShippingPrice: createMedusaShippingPriceClient(clientOptions),
    updateTenantShopSettings,
  };
}
