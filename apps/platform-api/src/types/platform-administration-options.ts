import type { SuperadminTenant } from "@ecs/contracts";
import type { MerchantPermissionRequest } from "../context/merchant-permissions.js";
import type {
  PlatformAuthorizationResult,
  PlatformPermission,
} from "../context/platform-authorization.js";
import type {
  MerchantPromotionDeleteResult,
  MerchantPromotionInput,
  MerchantPromotionResult,
  MerchantPromotionsResult,
} from "./promotion.js";
import type { DashboardAuthorizationResult, PlatformSession } from "./session.js";

export type PlatformAdministrationOptions = {
  /** Browser origins allowed to perform the read-only landing-page session probe. */
  landingPublicOrigins?: string[];
  listEmailTemplates?: ReturnType<
    typeof import("../modules/email/template-service.js").createEmailTemplateService
  >["list"];
  getEmailTemplate?: ReturnType<
    typeof import("../modules/email/template-service.js").createEmailTemplateService
  >["get"];
  saveEmailTemplateDraft?: ReturnType<
    typeof import("../modules/email/template-service.js").createEmailTemplateService
  >["saveDraft"];
  publishEmailTemplate?: ReturnType<
    typeof import("../modules/email/template-service.js").createEmailTemplateService
  >["publish"];
  restoreEmailTemplateVersion?: ReturnType<
    typeof import("../modules/email/template-service.js").createEmailTemplateService
  >["restore"];
  previewEmailTemplate?: ReturnType<
    typeof import("../modules/email/template-service.js").createEmailTemplateService
  >["preview"];
  sendEmailTemplateTest?: ReturnType<
    typeof import("../modules/email/template-service.js").createEmailTemplateService
  >["sendTest"];
  dashboardPublicBaseUrl?: string;
  emailDeliveryConfigured?: boolean;
  getMerchantCapabilities?: ReturnType<
    typeof import("../context/merchant-authorization.js").createMerchantCapabilityLookup
  >;
  merchantTeamService?: ReturnType<
    typeof import("../modules/team/merchant-team-service.js").createMerchantTeamService
  >;
  listPlatformStorefrontTemplates?: ReturnType<
    typeof import("../modules/storefront/platform-template-assets.js").createPlatformTemplateAssetService
  >["listTemplates"];
  createPlatformTemplatePreviewUpload?: ReturnType<
    typeof import("../modules/storefront/platform-template-assets.js").createPlatformTemplateAssetService
  >["createUpload"];
  completePlatformTemplatePreviewUpload?: ReturnType<
    typeof import("../modules/storefront/platform-template-assets.js").createPlatformTemplateAssetService
  >["completeUpload"];
  updatePlatformStorefrontTemplate?: ReturnType<
    typeof import("../modules/storefront/platform-template-assets.js").createPlatformTemplateAssetService
  >["updateTemplatePresentation"];
  createReviewedProductImportArtifact?: ReturnType<
    typeof import("../modules/data-transfer/product-import-artifact.js").createProductImportArtifactService
  >["createReviewedArtifact"];
  requestProductImportApply?: ReturnType<
    typeof import("../modules/data-transfer/product-import-execution.js").createProductImportExecutionService
  >["requestApply"];
  getProductImportExecution?: ReturnType<
    typeof import("../modules/data-transfer/product-import-execution.js").createProductImportExecutionService
  >["getExecution"];
  createEntitlementOverride?: ReturnType<
    typeof import("../modules/entitlements/service.js").createEntitlementService
  >["createOverride"];
  revokeEntitlementOverride?: ReturnType<
    typeof import("../modules/entitlements/service.js").createEntitlementService
  >["revokeOverride"];
  getEntitlementSummary?: ReturnType<
    typeof import("../modules/entitlements/service.js").createEntitlementService
  >["getSummary"];
  getPlanAdministrationCatalog?: ReturnType<
    typeof import("../modules/billing/plan-administration.js").createPlanAdministrationService
  >["getCatalog"];
  createPlan?: ReturnType<
    typeof import("../modules/billing/plan-administration.js").createPlanAdministrationService
  >["createPlan"];
  savePlanPresentation?: ReturnType<
    typeof import("../modules/billing/plan-administration.js").createPlanAdministrationService
  >["savePresentation"];
  savePlanDraft?: ReturnType<
    typeof import("../modules/billing/plan-administration.js").createPlanAdministrationService
  >["saveDraft"];
  publishPlanDraft?: ReturnType<
    typeof import("../modules/billing/plan-administration.js").createPlanAdministrationService
  >["publishDraft"];
  migrateSubscriptionPlanVersion?: ReturnType<
    typeof import("../modules/billing/plan-administration.js").createPlanAdministrationService
  >["migrateSubscriptionNow"];
  getSuperadminOperationalSummary?: ReturnType<
    typeof import("../modules/superadmin/operational-summary-service.js").createSuperadminOperationalSummaryService
  >;
  getSuperadminDiagnostics?: ReturnType<
    typeof import("../modules/superadmin/diagnostics-service.js").createSuperadminDiagnosticsService
  >;
  getCustomerCommerceState?: ReturnType<
    typeof import("../modules/storefront/customer-commerce-service.js").createCustomerCommerceService
  >["getState"];
  updateCustomerCommerceState?: ReturnType<
    typeof import("../modules/storefront/customer-commerce-service.js").createCustomerCommerceService
  >["updateState"];
  createStorefrontInquiry?:
    | ((
        input: import("../modules/storefront/inquiry-service.js").StorefrontInquiryInput,
      ) => Promise<{
        ok: true;
        inquiry: { id: string; createdAt: string };
      }>)
    | undefined;
  listStorefrontInquiries?: ReturnType<
    typeof import("../modules/storefront/inquiry-service.js").createStorefrontInquiryService
  >["listInquiries"];
  getStorefrontInquiry?: ReturnType<
    typeof import("../modules/storefront/inquiry-service.js").createStorefrontInquiryService
  >["getInquiry"];
  updateStorefrontInquiryStatus?: ReturnType<
    typeof import("../modules/storefront/inquiry-service.js").createStorefrontInquiryService
  >["updateInquiryStatus"];
  /** Shared HMAC secret for short-lived, tenant-scoped Astro editor previews. */
  storefrontPreviewSecret?: string | undefined;
  /** Optional structured logger (used for HTTP access logs in development). */
  logger?: {
    info: (obj: Record<string, unknown>, msg?: string) => void;
    debug?: (obj: Record<string, unknown>, msg?: string) => void;
  };
  listMerchantPromotions?:
    | ((input: {
        schedule?: "scheduled" | "current" | "expired" | "unscheduled" | undefined;
        apply?: "code" | "automatic" | undefined;
        limit: number;
        offset: number;
        offer?:
          | "order"
          | "products"
          | "free_shipping"
          | "buyget"
          | "percentage"
          | "fixed"
          | undefined;
        query?: string | undefined;
        status?: "active" | "inactive" | "draft" | undefined;
        tenantId: string;
      }) => Promise<MerchantPromotionsResult>)
    | undefined;
  createMerchantPromotion?:
    | ((input: MerchantPromotionInput) => Promise<MerchantPromotionResult>)
    | undefined;
  updateMerchantPromotion?:
    | ((
        input: MerchantPromotionInput & { promotionId: string },
      ) => Promise<MerchantPromotionResult>)
    | undefined;
  deleteMerchantPromotion?:
    | ((input: { promotionId: string; tenantId: string }) => Promise<MerchantPromotionDeleteResult>)
    | undefined;
  authorizeDashboardForTenant?:
    | ((input: {
        tenantId: string;
        userId: string;
        permission?: MerchantPermissionRequest;
      }) => Promise<DashboardAuthorizationResult>)
    | undefined;
  authorizePlatformPermission?:
    | ((input: {
        permission: PlatformPermission;
        userId: string;
      }) => Promise<PlatformAuthorizationResult>)
    | undefined;
  getPlatformPrincipalAccess?: ReturnType<
    typeof import("../context/platform-authorization.js").createPlatformPrincipalAccessLookup
  >;
  getSuperadminOverview?: ReturnType<
    typeof import("../modules/superadmin/overview-service.js").createSuperadminOverviewService
  >;
  getSuperadminCommerceReview?: ReturnType<
    typeof import("../modules/superadmin/commerce-review-service.js").createSuperadminCommerceReviewService
  >;
  listSuperadminWork?: ReturnType<
    typeof import("../modules/superadmin/console-read-service.js").createSuperadminConsoleReadService
  >["listWork"];
  listSuperadminAudit?: ReturnType<
    typeof import("../modules/superadmin/console-read-service.js").createSuperadminConsoleReadService
  >["listAudit"];
  listPlatformOperators?: ReturnType<
    typeof import("../modules/superadmin/console-read-service.js").createSuperadminConsoleReadService
  >["listOperators"];
  getPlatformHealth?: ReturnType<
    typeof import("../modules/superadmin/console-read-service.js").createSuperadminConsoleReadService
  >["getHealth"];
  getJobOperations?:
    | (() => Promise<{
        runs: import("@ecs/jobs").JobRunSummary[];
        queues: import("@ecs/jobs").JobQueueHealth[];
        scheduler: import("@ecs/jobs").JobSchedulerHealth;
      }>)
    | undefined;
  retryFailedJob?: ((id: string) => Promise<import("@ecs/jobs").JobControlResult>) | undefined;
  cancelQueuedJob?: ((id: string) => Promise<import("@ecs/jobs").JobControlResult>) | undefined;
  recoverSuperadminWork?: ReturnType<
    typeof import("../modules/superadmin/work-recovery-service.js").createSuperadminWorkRecoveryService
  >;
  listSuperadminTenants?:
    | ((input: { limit: number; offset: number; query?: string | undefined }) => Promise<{
        tenants: SuperadminTenant[];
        count: number;
        limit: number;
        offset: number;
      }>)
    | undefined;
  getSuperadminTenant?:
    | ((input: {
        tenantId: string;
      }) => Promise<
        { ok: true; tenant: SuperadminTenant } | { ok: false; error: "tenant_not_found" }
      >)
    | undefined;
  authHandler?: ((request: Request) => Promise<Response>) | undefined;
  getSession?: ((headers: Headers) => Promise<PlatformSession | null>) | undefined;
};
