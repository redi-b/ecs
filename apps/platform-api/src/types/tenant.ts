import type { DashboardActorRole } from "./session.js";

export type TenantStatus = "draft" | "active" | "suspended" | "cancelled";

export type TenantStatusUpdateResult =
  | {
      ok: true;
      tenant: {
        id: string;
        name: string;
        handle: string;
        status: string;
      };
    }
  | {
      ok: false;
      error: "tenant_not_found" | "tenant_status_invalid";
      status: 400 | 404;
    };

export type TenantReadinessMissingReason =
  | "tenant_inactive"
  | "primary_domain_missing"
  | "primary_domain_inactive"
  | "primary_domain_unverified"
  | "commerce_store_missing"
  | "commerce_sales_channel_missing"
  | "commerce_publishable_key_missing"
  | "commerce_region_missing"
  | "commerce_shipping_option_missing"
  | "storefront_draft_missing"
  | "storefront_unpublished"
  | "provisioning_failed";

export type TenantProvisioningAttemptSummary = {
  id: string;
  completedAt: string | null;
  createdAt?: string;
  error: string | null;
  handle?: string;
  name?: string;
  platformTenantId?: string;
  status: string;
  step: string;
  tenantId?: string | null;
};

export type TenantProvisioningAttemptListResult = {
  ok: true;
  attempts: Required<TenantProvisioningAttemptSummary>[];
  count: number;
  limit: number;
  offset: number;
};

export type TenantListItem = {
  id: string;
  name: string;
  handle: string;
  status: string;
  role: DashboardActorRole;
  primaryDomain: {
    hostname: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type TenantListResult = {
  ok: true;
  tenants: TenantListItem[];
  count: number;
  limit: number;
  offset: number;
};

export type TenantHandleAvailabilityResult = {
  handle: string;
  available: boolean;
  reason?: "invalid" | "reserved" | "taken";
  hostname?: string;
};

export type PlatformOnboardingStateResult =
  | {
      ok: true;
      state: {
        user: {
          id: string;
          email: string;
          name: string | null;
        };
        tenants: TenantListItem[];
        primaryTenant: {
          id: string;
          handle: string;
          primaryDomain: string;
          dashboardUrl: string;
        } | null;
        latestProvisioningAttempt: {
          id: string;
          handle: string;
          name: string | null;
          status: string;
          step: string;
          error: string | null;
        } | null;
      };
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

export type TenantDetailResult =
  | {
      ok: true;
      tenant: TenantListItem;
    }
  | {
      ok: false;
      error: "tenant_not_found";
      status: 404;
    };

export type TenantShopSettingsUpdateResult =
  | {
      ok: true;
      tenant: TenantListItem;
      redirectTo: string | null;
    }
  | {
      ok: false;
      error:
        | "handle_invalid"
        | "handle_reserved"
        | "handle_unavailable"
        | "tenant_name_invalid"
        | "tenant_not_found";
      status: 400 | 404 | 409;
    };

export type TenantReadiness = {
  ready: boolean;
  missing: TenantReadinessMissingReason[];
  tenant: {
    id: string;
    name: string;
    handle: string;
    status: string;
  };
  checks: {
    tenant: {
      ready: boolean;
      missing: TenantReadinessMissingReason[];
      isActive: boolean;
    };
    domain: {
      ready: boolean;
      missing: TenantReadinessMissingReason[];
      hasPrimaryDomain: boolean;
      isActive: boolean;
      isVerified: boolean;
    };
    commerce: {
      ready: boolean;
      missing: TenantReadinessMissingReason[];
      hasStore: boolean;
      hasSalesChannel: boolean;
      hasPublishableKey: boolean;
      hasRegion: boolean;
      hasShippingOption: boolean;
    };
    storefront: {
      ready: boolean;
      missing: TenantReadinessMissingReason[];
      hasDraft: boolean;
      isPublished: boolean;
    };
    provisioning: {
      ready: boolean;
      missing: TenantReadinessMissingReason[];
      latestAttempt: TenantProvisioningAttemptSummary | null;
    };
  };
};

export type TenantReadinessResult =
  | {
      ok: true;
      readiness: TenantReadiness;
    }
  | {
      ok: false;
      error: "tenant_not_found";
      status: 404;
    };

export type TenantCommerceContextResult =
  | {
      ok: true;
      context: {
        tenantId: string;
        medusaStoreId: string | null;
        medusaSalesChannelId: string;
        medusaStockLocationId?: string | null;
        medusaPublishableKeyId: string | null;
        medusaRegionId: string | null;
        medusaShippingProfileId?: string | null;
        medusaShippingOptionId?: string | null;
      };
    }
  | {
      ok: false;
      error:
        | "tenant_not_found"
        | "commerce_store_unavailable"
        | "commerce_sales_channel_unavailable"
        | "inventory_location_unavailable"
        | "commerce_publishable_key_unavailable"
        | "commerce_region_unavailable";
      status: 404 | 503;
    };

export type TenantDashboardSummaryResult =
  | {
      ok: true;
      summary: {
        tenant: {
          id: string;
          name: string;
          handle: string;
          status: string;
        };
        domain: {
          id: string;
          hostname: string;
        };
        commerce: {
          hasPublishableKey: boolean;
          hasSalesChannel: boolean;
          hasStore: boolean;
        };
        storefront: {
          isPublished: boolean;
          publishedRevisionId: string | null;
          templateId: string | null;
          templateKey: string | null;
          templateVersion: number | null;
        };
      };
    }
  | {
      ok: false;
      error: "tenant_not_found";
      status: 404;
    };

export type TenantDomain = {
  id: string;
  hostname: string;
  type: string;
  status: string;
  isPrimary: boolean;
  verificationStatus: string;
  sslStatus: string;
};

export type TenantDomainListResult = {
  ok: true;
  domains: TenantDomain[];
};

export type TenantDomainCreateResult =
  | {
      ok: true;
      domain: TenantDomain;
    }
  | {
      ok: false;
      error: "domain_invalid" | "domain_unavailable";
      status: 400 | 409;
    };

export type TenantDomainPrimaryResult =
  | {
      ok: true;
      domain: TenantDomain;
    }
  | {
      ok: false;
      error: "domain_not_found" | "domain_not_verified";
      status: 404 | 409;
    };

export type TenantOnboardingResult =
  | {
      ok: true;
      onboarding: {
        tenantId: string;
        status: string;
        currentStep: string;
        completedSteps: unknown;
      };
    }
  | {
      ok: false;
      error: "onboarding_not_found";
    };

export type TenantShopProvisioningResult =
  | {
      ok: true;
      tenant: {
        createdAt: string;
        id: string;
        name: string;
        handle: string;
        role: "owner";
        status: string;
        primaryDomain: {
          hostname: string;
        };
        updatedAt: string;
      };
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "handle_invalid"
        | "handle_reserved"
        | "handle_unavailable"
        | "provisioning_attempt_not_found"
        | "provisioning_attempt_not_retryable"
        | "template_unavailable"
        | "storefront_template_unavailable";
      status: 400 | 404 | 409 | 503;
    };
