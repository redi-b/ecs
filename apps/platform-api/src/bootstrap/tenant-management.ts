import { resolveTxt as resolveDnsTxt } from "node:dns/promises";
import type { createPlatformDb } from "@ecs/db";
import { createDomainManagementService } from "../modules/domains/service.js";
import { createEntitlementService } from "../modules/entitlements/service.js";
import { createTenantOnboardingService } from "../modules/onboarding/service.js";
import { createPaymentOnboardingService } from "../modules/payments/payment-onboarding-service.js";
import { createReceivingAccountsService } from "../modules/payments/receiving-accounts-service.js";
import {
  createTenantCommerceContextService,
  createTenantDashboardSummaryService,
} from "../modules/tenants/commerce-context-service.js";
import {
  createTenantDetailService,
  createTenantListService,
  createTenantMembershipSummaryService,
} from "../modules/tenants/list-service.js";
import { createTenantStatusService } from "../modules/tenants/status-service.js";

type TenantManagementRuntimeOptions = {
  db: ReturnType<typeof createPlatformDb>["db"];
  env: NodeJS.ProcessEnv;
};

export function createTenantManagementRuntime(options: TenantManagementRuntimeOptions) {
  const entitlementService = createEntitlementService(options.db);
  const encryptionKey =
    options.env.PAYMENTS_CREDENTIALS_ENCRYPTION_KEY ?? options.env.CHAPA_SECRET_KEY;

  return {
    domainManagementService: createDomainManagementService(options.db, {
      evaluateEntitlement: entitlementService.evaluate,
      resolveTxt: resolveDnsTxt,
    }),
    entitlementService,
    getTenantCommerceContext: createTenantCommerceContextService(options.db),
    getTenantDashboardSummary: createTenantDashboardSummaryService(options.db),
    getTenantForUser: createTenantDetailService(options.db),
    getTenantMembershipSummary: createTenantMembershipSummaryService(options.db),
    listTenantsForUser: createTenantListService(options.db),
    paymentOnboardingService: createPaymentOnboardingService(options.db, {
      paymentsCredentialsEncryptionKey: encryptionKey,
    }),
    receivingAccountsService: createReceivingAccountsService(options.db, {
      encryptionKey,
    }),
    tenantOnboardingService: createTenantOnboardingService(options.db),
    tenantStatusService: createTenantStatusService(options.db),
  };
}
