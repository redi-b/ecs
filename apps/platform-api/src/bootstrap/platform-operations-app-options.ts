import type { PlatformAppOptions } from "../types/platform-app.js";
import type { createJobsRuntime } from "./jobs.js";
import type { createPlatformOperationsRuntime } from "./platform-operations.js";
import type { createTenantRuntime } from "./tenant.js";
import type { createTenantManagementRuntime } from "./tenant-management.js";

type OperationsAppOptionKey =
  | "authorizeDashboardForTenant"
  | "authorizePlatformPermission"
  | "cancelQueuedJob"
  | "createEntitlementOverride"
  | "createOperatorSupportNote"
  | "createSupportAccessGrant"
  | "getEntitlementSummary"
  | "getJobOperations"
  | "getMerchantCapabilities"
  | "getOperatorSupportHistory"
  | "getPlatformHealth"
  | "getPlatformPrincipalAccess"
  | "getSuperadminCommerceReview"
  | "getSuperadminDiagnostics"
  | "getSuperadminOperationalSummary"
  | "getSuperadminOverview"
  | "getSuperadminTenant"
  | "listPlatformOperators"
  | "listSuperadminAudit"
  | "listSuperadminTenants"
  | "listSuperadminWork"
  | "listSupportAccessGrants"
  | "recoverSuperadminWork"
  | "retryFailedJob"
  | "revokeEntitlementOverride"
  | "revokeSupportAccessGrant";

type PlatformOperationsAppOptionsInput = {
  entitlementService: ReturnType<typeof createTenantManagementRuntime>["entitlementService"];
  jobsClient: ReturnType<typeof createJobsRuntime>["jobsClient"];
  recoverSuperadminWork: ReturnType<typeof createTenantRuntime>["recoverSuperadminWork"];
  runtime: ReturnType<typeof createPlatformOperationsRuntime>;
};

export function createPlatformOperationsAppOptions({
  entitlementService,
  jobsClient,
  recoverSuperadminWork,
  runtime,
}: PlatformOperationsAppOptionsInput): Pick<PlatformAppOptions, OperationsAppOptionKey> {
  const {
    authorizeDashboardForTenant,
    authorizePlatformPermission,
    getMerchantCapabilities,
    getPlatformPrincipalAccess,
    getSuperadminCommerceReview,
    getSuperadminDiagnostics,
    getSuperadminOperationalSummary,
    getSuperadminOverview,
    superadminConsoleReadService,
    superadminTenantProjectionService,
    supportAccessService,
    supportService,
  } = runtime;

  return {
    authorizeDashboardForTenant,
    authorizePlatformPermission,
    createEntitlementOverride: entitlementService.createOverride,
    createOperatorSupportNote: supportService.createOperatorSupportNote,
    createSupportAccessGrant: supportAccessService.create,
    getEntitlementSummary: entitlementService.getSummary,
    getMerchantCapabilities,
    getOperatorSupportHistory: supportService.getOperatorSupportHistory,
    getPlatformHealth: superadminConsoleReadService.getHealth,
    getPlatformPrincipalAccess,
    getSuperadminCommerceReview,
    getSuperadminDiagnostics,
    getSuperadminOperationalSummary,
    getSuperadminOverview,
    getSuperadminTenant: superadminTenantProjectionService.get,
    listPlatformOperators: superadminConsoleReadService.listOperators,
    listSuperadminAudit: superadminConsoleReadService.listAudit,
    listSuperadminTenants: superadminTenantProjectionService.list,
    listSuperadminWork: superadminConsoleReadService.listWork,
    listSupportAccessGrants: supportAccessService.list,
    recoverSuperadminWork,
    revokeEntitlementOverride: entitlementService.revokeOverride,
    revokeSupportAccessGrant: supportAccessService.revoke,
    ...(jobsClient
      ? {
          getJobOperations: async () => ({
            runs: await jobsClient.listOperationalJobs({ limit: 30 }),
            queues: await jobsClient.getQueueHealth(),
            scheduler: await jobsClient.getSchedulerHealth(),
          }),
          retryFailedJob: (id: string) => jobsClient.retryFailedJob(id),
          cancelQueuedJob: (id: string) => jobsClient.cancelQueuedJob(id),
        }
      : {}),
  };
}
