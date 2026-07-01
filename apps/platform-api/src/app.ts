import { Hono } from "hono";

import type {
  AnalyticsEventRecordInput,
  AnalyticsEventRecordResult,
  TenantInsightsSummaryResult,
} from "./analytics/analytics-service.js";
import { registerMerchantRoutes } from "./routes/merchant-routes.js";
import { registerPlatformRoutes } from "./routes/platform-routes.js";
import { registerStoreFacadeRoutes } from "./routes/store-facade-routes.js";
import type { TenantResolutionResult } from "./tenancy/tenant-resolver.js";

export type { AnalyticsEventRecordInput, AnalyticsEventRecordResult, TenantInsightsSummaryResult };

export type DashboardActorRole = "owner" | "manager" | "staff" | "operator";

export type TenantStatus = "draft" | "active" | "suspended" | "cancelled";

export type PlatformSessionUser = {
  id: string;
  email: string;
  name: string;
};

export type PlatformSession = {
  user: PlatformSessionUser;
};

export type BillingInvoice = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  dueAt: string | null;
  paidAt: string | null;
  provider: string | null;
  providerReference: string | null;
  createdAt: string;
};

export type BillingStatus = {
  subscription: {
    id: string;
    status: string;
    billingCycle: string;
    manualPaymentState: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  };
  plan: {
    id: string;
    name: string;
    price: string;
    limits: unknown;
    features: unknown;
  };
  invoices: BillingInvoice[];
};

export type BillingStatusResult =
  | {
      ok: true;
      billing: BillingStatus;
    }
  | {
      ok: false;
      error: "billing_not_found";
    };

export type DeliverySettings = {
  tenantId: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  phoneConfirmationRequired: boolean;
  notesEnabled: boolean;
  landmarkRequired: boolean;
  defaultDeliveryFee: string;
  currency: string;
  zones: unknown[];
  updatedAt: string;
};

export type DeliverySettingsResult = {
  ok: true;
  delivery: DeliverySettings;
};

export type DeliverySettingsUpdateResult = DeliverySettingsResult;

export type NotificationEventType =
  | "cod_order.created"
  | "chapa.onboarding_needs_review"
  | "domain.misconfigured"
  | "order.created"
  | "order.cancelled"
  | "order.confirmed"
  | "order.delivered"
  | "order.out_for_delivery"
  | "order.ready"
  | "payment.paid"
  | "payment.failed"
  | "payment.webhook_failed"
  | "shop.provisioning_failed"
  | "shop.published"
  | "shop.suspended";

export type NotificationChannel = "email" | "telegram";

export type NotificationPreference = {
  id: string;
  channel: string;
  enabled: boolean;
  events: string[];
  target: string;
  updatedAt: string;
};

export type NotificationPreferenceListResult = {
  ok: true;
  preferences: NotificationPreference[];
};

export type NotificationPreferenceUpsertResult =
  | {
      ok: true;
      preference: NotificationPreference;
    }
  | {
      ok: false;
      error:
        | "notification_channel_invalid"
        | "notification_events_invalid"
        | "notification_target_invalid";
      status: 400;
    };

export type NotificationEventRecordResult = {
  ok: true;
  logCount: number;
};

export type ChapaPaymentCallbackResult =
  | {
      ok: true;
      eventType: "payment.failed" | "payment.paid";
      providerReference: string | null;
      status: string;
      tenantId: string;
      txRef: string;
    }
  | {
      ok: false;
      error:
        | "chapa_payment_not_found"
        | "chapa_verification_failed"
        | "missing_tenant_context"
        | "missing_tx_ref";
      status: 400 | 404 | 502;
    };

export type BillingInvoiceUpdateResult =
  | {
      ok: true;
      invoice: BillingInvoice;
    }
  | {
      ok: false;
      error: "billing_invoice_not_found" | "billing_invoice_status_invalid";
      status: 400 | 404;
    };

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

export type SupportHistoryResult = {
  ok: true;
  history: {
    notes: SupportNote[];
    auditLogs: {
      id: string;
      actorUserId: string | null;
      action: string;
      targetType: string;
      targetId: string | null;
      metadata: unknown;
      createdAt: string;
    }[];
  };
};

export type SupportNote = {
  id: string;
  operatorUserId: string;
  body: string;
  visibility: string;
  createdAt: string;
};

export type SupportNoteCreateResult = {
  ok: true;
  note: SupportNote;
};

export type MerchantProduct = {
  id: string;
  title: string | null;
  handle: string | null;
  status: string | null;
  thumbnail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MerchantProductsResult =
  | {
      ok: true;
      count: number;
      limit: number;
      offset: number;
      products: MerchantProduct[];
    }
  | {
      ok: false;
      error: "commerce_backend_unavailable" | "commerce_credentials_missing";
      status: 401 | 503;
    };

export type MerchantProductWriteResult =
  | {
      ok: true;
      product: MerchantProduct;
    }
  | {
      ok: false;
      error: "commerce_backend_unavailable" | "commerce_credentials_missing" | "product_not_found";
      status: 401 | 404 | 503;
    };

export type MerchantOrder = {
  id: string;
  displayId: number | null;
  email: string | null;
  status: string | null;
  paymentStatus: string | null;
  fulfillmentStatus: string | null;
  currencyCode: string | null;
  total: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MerchantOrdersResult =
  | {
      ok: true;
      count: number;
      limit: number;
      offset: number;
      orders: MerchantOrder[];
    }
  | {
      ok: false;
      error: "commerce_backend_unavailable" | "commerce_credentials_missing";
      status: 401 | 503;
    };

export type TenantCommerceContextResult =
  | {
      ok: true;
      context: {
        tenantId: string;
        medusaStoreId: string | null;
        medusaSalesChannelId: string;
        medusaPublishableKeyId: string | null;
        medusaRegionId: string | null;
      };
    }
  | {
      ok: false;
      error: "tenant_not_found" | "commerce_sales_channel_unavailable";
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
          templateVersion: number | null;
        };
      };
    }
  | {
      ok: false;
      error: "tenant_not_found";
      status: 404;
    };

export type StorefrontTemplateCatalogItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  previewAssetId: string | null;
  tags: unknown;
  minimumPlanId: string | null;
  version: {
    id: string;
    version: number;
    templateKey: string;
    previewData: unknown;
  };
};

export type StorefrontTemplateSelectionResult =
  | {
      ok: true;
      draft: {
        tenantId: string;
        templateId: string;
        templateVersion: number;
        templateKey: string;
      };
    }
  | {
      ok: false;
      error: "template_not_found" | "tenant_not_found" | "template_plan_unavailable";
    };

export type StorefrontDraftResult =
  | {
      ok: true;
      draft: {
        tenantId: string;
        templateId: string;
        templateVersion: number;
        templateKey: string;
        data: unknown;
        themeTokens: unknown;
        updatedAt: string;
      };
    }
  | {
      ok: false;
      error: "storefront_draft_not_found";
    };

export type StorefrontDraftUpdateResult = StorefrontDraftResult;

export type StorefrontPublishResult =
  | {
      ok: true;
      storefront: {
        tenantId: string;
        publishedRevisionId: string;
        templateId: string;
        templateVersion: number;
        templateKey: string;
        publishedAt: string;
      };
    }
  | {
      ok: false;
      error: "storefront_draft_not_found";
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

export type PaymentOnboarding = {
  id: string;
  provider: string;
  status: string;
  requiredDocuments: unknown;
  notes: string | null;
  providerAccountRef: string | null;
};

export type PaymentOnboardingListResult = {
  ok: true;
  paymentOnboarding: PaymentOnboarding[];
};

export type PaymentOnboardingSubmitResult =
  | {
      ok: true;
      paymentOnboarding: PaymentOnboarding;
    }
  | {
      ok: false;
      error: "payment_provider_invalid";
      status: 400;
    };

export type PaymentOnboardingReviewResult =
  | {
      ok: true;
      paymentOnboarding: PaymentOnboarding;
    }
  | {
      ok: false;
      error: "payment_onboarding_not_found" | "payment_onboarding_status_invalid";
      status: 400 | 404;
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
        id: string;
        name: string;
        handle: string;
        status: string;
        primaryDomain: {
          hostname: string;
        };
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
        | "storefront_template_unavailable";
      status: 400 | 404 | 409 | 503;
    };

export type PublishedStorefrontConfigResult =
  | {
      ok: true;
      config: {
        publishedRevisionId: string;
        templateId: string;
        templateVersion: number;
        templateKey: string;
        data: unknown;
        themeTokens: unknown;
        publishedAt: string | null;
      };
    }
  | {
      ok: false;
      error: "published_revision_not_found";
    };

export type DashboardAuthorizationResult =
  | {
      ok: true;
      actor: {
        id: string;
        email: string;
        name: string | null;
        role: DashboardActorRole;
      };
    }
  | {
      ok: false;
    };

export type PlatformAppOptions = {
  authorizeDashboardForTenant?:
    | ((input: { tenantId: string; userId: string }) => Promise<DashboardAuthorizationResult>)
    | undefined;
  authHandler?: ((request: Request) => Promise<Response>) | undefined;
  getSession?: ((headers: Headers) => Promise<PlatformSession | null>) | undefined;
  handleChapaPaymentCallback?:
    | ((input: {
        providerReference?: string | null | undefined;
        reportedStatus?: string | null | undefined;
        tenantId?: string | null | undefined;
        txRef?: string | null | undefined;
      }) => Promise<ChapaPaymentCallbackResult>)
    | undefined;
  recordAnalyticsEvent?:
    | ((input: AnalyticsEventRecordInput) => Promise<AnalyticsEventRecordResult>)
    | undefined;
  getPublishedStorefrontConfig?:
    | ((input: {
        publishedRevisionId: string;
        tenantId: string;
      }) => Promise<PublishedStorefrontConfigResult>)
    | undefined;
  getStorefrontDraft?:
    | ((input: { tenantId: string }) => Promise<StorefrontDraftResult>)
    | undefined;
  updateStorefrontDraft?:
    | ((input: {
        data: unknown;
        tenantId: string;
        themeTokens: unknown;
        userId: string;
      }) => Promise<StorefrontDraftUpdateResult>)
    | undefined;
  publishStorefrontDraft?:
    | ((input: { tenantId: string; userId: string }) => Promise<StorefrontPublishResult>)
    | undefined;
  getBillingStatus?: ((input: { tenantId: string }) => Promise<BillingStatusResult>) | undefined;
  getDeliverySettings?:
    | ((input: { tenantId: string }) => Promise<DeliverySettingsResult>)
    | undefined;
  updateDeliverySettings?:
    | ((input: {
        currency: string;
        defaultDeliveryFee: string;
        deliveryEnabled: boolean;
        landmarkRequired: boolean;
        notesEnabled: boolean;
        phoneConfirmationRequired: boolean;
        pickupEnabled: boolean;
        tenantId: string;
        userId: string;
        zones: unknown[];
      }) => Promise<DeliverySettingsUpdateResult>)
    | undefined;
  getOperatorSupportHistory?:
    | ((input: { limit: number; tenantId: string }) => Promise<SupportHistoryResult>)
    | undefined;
  createOperatorSupportNote?:
    | ((input: {
        body: string;
        operatorUserId: string;
        tenantId: string;
        visibility?: string | null | undefined;
      }) => Promise<SupportNoteCreateResult>)
    | undefined;
  updateBillingInvoiceStatus?:
    | ((input: {
        invoiceId: string;
        operatorUserId: string;
        provider?: string | null | undefined;
        providerReference?: string | null | undefined;
        status: string;
        tenantId: string;
      }) => Promise<BillingInvoiceUpdateResult>)
    | undefined;
  updateTenantStatus?:
    | ((input: {
        operatorUserId: string;
        reason?: string | null | undefined;
        status: string;
        tenantId: string;
      }) => Promise<TenantStatusUpdateResult>)
    | undefined;
  getTenantReadiness?:
    | ((input: { tenantId: string }) => Promise<TenantReadinessResult>)
    | undefined;
  getTenantInsightsSummary?:
    | ((input: { days: number; tenantId: string }) => Promise<TenantInsightsSummaryResult>)
    | undefined;
  getTenantCommerceContext?:
    | ((input: { tenantId: string; userId: string }) => Promise<TenantCommerceContextResult>)
    | undefined;
  getTenantDashboardSummary?:
    | ((input: { tenantId: string }) => Promise<TenantDashboardSummaryResult>)
    | undefined;
  getTenantForUser?:
    | ((input: { tenantId: string; userId: string }) => Promise<TenantDetailResult>)
    | undefined;
  listTenantsForUser?:
    | ((input: { limit: number; offset: number; userId: string }) => Promise<TenantListResult>)
    | undefined;
  listTenantProvisioningAttempts?:
    | ((input: {
        limit: number;
        offset: number;
        userId: string;
      }) => Promise<TenantProvisioningAttemptListResult>)
    | undefined;
  getTenantOnboarding?:
    | ((input: { tenantId: string }) => Promise<TenantOnboardingResult>)
    | undefined;
  createMerchantProduct?:
    | ((input: {
        handle?: string | null | undefined;
        salesChannelId: string;
        status?: string | null | undefined;
        thumbnail?: string | null | undefined;
        title: string;
      }) => Promise<MerchantProductWriteResult>)
    | undefined;
  createTenantShop?:
    | ((input: {
        handle: string;
        name: string;
        ownerUserId: string;
      }) => Promise<TenantShopProvisioningResult>)
    | undefined;
  retryTenantShopProvisioningAttempt?:
    | ((input: { attemptId: string; userId: string }) => Promise<TenantShopProvisioningResult>)
    | undefined;
  createTenantDomain?:
    | ((input: {
        hostname: string;
        tenantId: string;
        userId: string;
      }) => Promise<TenantDomainCreateResult>)
    | undefined;
  listStorefrontTemplates?: (() => Promise<StorefrontTemplateCatalogItem[]>) | undefined;
  listTenantDomains?:
    | ((input: { tenantId: string }) => Promise<TenantDomainListResult>)
    | undefined;
  listPaymentOnboarding?:
    | ((input: { tenantId: string }) => Promise<PaymentOnboardingListResult>)
    | undefined;
  submitPaymentOnboarding?:
    | ((input: {
        notes?: string | null | undefined;
        provider: string;
        requiredDocuments: unknown[];
        tenantId: string;
        userId: string;
      }) => Promise<PaymentOnboardingSubmitResult>)
    | undefined;
  reviewPaymentOnboarding?:
    | ((input: {
        notes?: string | null | undefined;
        operatorUserId: string;
        paymentOnboardingId: string;
        providerAccountRef?: string | null | undefined;
        status: string;
        tenantId: string;
      }) => Promise<PaymentOnboardingReviewResult>)
    | undefined;
  setTenantPrimaryDomain?:
    | ((input: {
        domainId: string;
        tenantId: string;
        userId: string;
      }) => Promise<TenantDomainPrimaryResult>)
    | undefined;
  listMerchantProducts?:
    | ((input: {
        limit: number;
        offset: number;
        salesChannelId: string;
      }) => Promise<MerchantProductsResult>)
    | undefined;
  listMerchantOrders?:
    | ((input: {
        limit: number;
        offset: number;
        salesChannelId: string;
      }) => Promise<MerchantOrdersResult>)
    | undefined;
  listNotificationPreferences?:
    | ((input: { tenantId: string }) => Promise<NotificationPreferenceListResult>)
    | undefined;
  recordNotificationEvent?:
    | ((input: {
        eventType: NotificationEventType;
        payload?: unknown;
        tenantId: string;
      }) => Promise<NotificationEventRecordResult>)
    | undefined;
  upsertNotificationPreference?:
    | ((input: {
        channel: string;
        enabled: boolean;
        events: string[];
        target: string;
        tenantId: string;
        userId: string;
      }) => Promise<NotificationPreferenceUpsertResult>)
    | undefined;
  selectStorefrontTemplate?:
    | ((input: {
        tenantId: string;
        templateKey: string;
        userId: string;
      }) => Promise<StorefrontTemplateSelectionResult>)
    | undefined;
  updateMerchantProduct?:
    | ((input: {
        handle?: string | null | undefined;
        productId: string;
        salesChannelId: string;
        status?: string | null | undefined;
        thumbnail?: string | null | undefined;
        title?: string | null | undefined;
      }) => Promise<MerchantProductWriteResult>)
    | undefined;
  serviceName: string;
  medusaInternalUrl: string;
  platformPublicBaseUrl: string;
  medusaStoreFetch?: typeof fetch;
  resolveTenantForHost: (host?: string) => Promise<TenantResolutionResult>;
};

export type PlatformAppVariables = {
  requestId: string;
};

function createRequestId() {
  return crypto.randomUUID();
}

async function maybeAttachRequestIdToErrorBody(response: Response, requestId: string) {
  if (
    response.status < 400 ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    return response;
  }

  const data = await response
    .clone()
    .json()
    .catch(() => undefined);

  if (typeof data !== "object" || data === null || !("error" in data) || "requestId" in data) {
    return response;
  }

  return new Response(
    JSON.stringify({
      ...data,
      requestId,
    }),
    {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    },
  );
}

export function createPlatformApp(options: PlatformAppOptions) {
  const app = new Hono<{ Variables: PlatformAppVariables }>();
  const medusaStoreFetch = options.medusaStoreFetch ?? fetch;

  app.use("*", async (context, next) => {
    const incomingRequestId = context.req.raw.headers.get("x-request-id")?.trim();
    const requestId = incomingRequestId || createRequestId();
    context.set("requestId", requestId);

    await next();

    context.res.headers.set("x-request-id", requestId);

    if (incomingRequestId && !new URL(context.req.raw.url).pathname.startsWith("/store/")) {
      context.res = await maybeAttachRequestIdToErrorBody(context.res, requestId);
      context.res.headers.set("x-request-id", requestId);
    }
  });

  registerPlatformRoutes(app, options);
  registerMerchantRoutes(app, options);
  registerStoreFacadeRoutes(app, options, medusaStoreFetch);

  return app;
}
