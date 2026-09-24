import type { createPlatformDb } from "@ecs/db";
import { createDashboardAuthorizationLookup } from "../context/dashboard-authorization.js";
import { createMerchantCapabilityLookup } from "../context/merchant-authorization.js";
import {
  createPlatformPermissionAuthorization,
  createPlatformPrincipalAccessLookup,
} from "../context/platform-authorization.js";
import { createSuperadminCommerceReviewService } from "../modules/superadmin/commerce-review-service.js";
import { createSuperadminConsoleReadService } from "../modules/superadmin/console-read-service.js";
import {
  createDependencyHealthService,
  createHttpHealthCheck,
} from "../modules/superadmin/dependency-health-service.js";
import { createSuperadminDiagnosticsService } from "../modules/superadmin/diagnostics-service.js";
import { createSuperadminOperationalSummaryService } from "../modules/superadmin/operational-summary-service.js";
import { createSuperadminOverviewService } from "../modules/superadmin/overview-service.js";
import { createSuperadminTenantProjectionService } from "../modules/superadmin/tenant-projection-service.js";
import { createSupportAccessService } from "../modules/support/access-service.js";
import { createSupportService } from "../modules/support/service.js";

type BillingRuntime = ReturnType<typeof import("./billing.js").createBillingRuntime>;
type JobsRuntime = ReturnType<typeof import("./jobs.js").createJobsRuntime>;
type MediaRuntime = ReturnType<typeof import("./media.js").createMediaRuntime>;
type PaymentOnboardingService = ReturnType<
  typeof import("../modules/payments/payment-onboarding-service.js").createPaymentOnboardingService
>;
type TenantStatusService = ReturnType<
  typeof import("../modules/tenants/status-service.js").createTenantStatusService
>;
type DomainManagementService = ReturnType<
  typeof import("../modules/domains/service.js").createDomainManagementService
>;

type PlatformOperationsRuntimeOptions = {
  billingService: BillingRuntime["billingService"];
  db: ReturnType<typeof createPlatformDb>["db"];
  domainManagementService: DomainManagementService;
  env: NodeJS.ProcessEnv;
  jobsClient: JobsRuntime["jobsClient"];
  mediaStorage: MediaRuntime["storage"];
  paymentOnboardingService: PaymentOnboardingService;
  tenantStatusService: TenantStatusService;
};

export function createPlatformOperationsRuntime(options: PlatformOperationsRuntimeOptions) {
  const medusaInternalUrl = options.env.MEDUSA_INTERNAL_URL ?? "http://localhost:9000";
  const storefrontInternalBaseUrl =
    options.env.STOREFRONT_INTERNAL_BASE_URL ?? "http://localhost:4321";
  const jobsClient = options.jobsClient;
  const dependencyHealth = createDependencyHealthService({
    checks: {
      commerce_backend: createHttpHealthCheck(new URL("/health", medusaInternalUrl).toString()),
      storefront_runtime: createHttpHealthCheck(
        new URL("/", storefrontInternalBaseUrl).toString(),
        { acceptAnyResponse: true },
      ),
      job_queue: jobsClient ? () => jobsClient.ping() : null,
      media_storage:
        options.mediaStorage.provider === "unconfigured"
          ? null
          : () => options.mediaStorage.checkHealth(),
    },
  });

  return {
    authorizeDashboardForTenant: createDashboardAuthorizationLookup(options.db),
    authorizePlatformPermission: createPlatformPermissionAuthorization(options.db),
    getMerchantCapabilities: createMerchantCapabilityLookup(options.db),
    getPlatformPrincipalAccess: createPlatformPrincipalAccessLookup(options.db),
    getSuperadminCommerceReview: createSuperadminCommerceReviewService({
      getBillingStatus: options.billingService.getBillingStatus,
      listPaymentOnboarding: options.paymentOnboardingService.listPaymentOnboarding,
    }),
    getSuperadminDiagnostics: createSuperadminDiagnosticsService(options.db),
    getSuperadminOperationalSummary: createSuperadminOperationalSummaryService({
      getBillingStatus: options.billingService.getBillingStatus,
      getTenantReadiness: options.tenantStatusService.getTenantReadiness,
      listPaymentOnboarding: options.paymentOnboardingService.listPaymentOnboarding,
      listTenantDomains: options.domainManagementService.listTenantDomains,
    }),
    getSuperadminOverview: createSuperadminOverviewService(options.db),
    medusaInternalUrl,
    superadminConsoleReadService: createSuperadminConsoleReadService(options.db, {
      getDependencies: dependencyHealth,
    }),
    superadminTenantProjectionService: createSuperadminTenantProjectionService(options.db),
    supportAccessService: createSupportAccessService(options.db),
    supportService: createSupportService(options.db),
  };
}
