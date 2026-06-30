import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  AnalyticsEventRecordResult,
  BillingInvoiceUpdateResult,
  BillingStatusResult,
  ChapaPaymentCallbackResult,
  DeliverySettingsResult,
  DeliverySettingsUpdateResult,
  MerchantOrdersResult,
  MerchantProductsResult,
  MerchantProductWriteResult,
  NotificationEventRecordResult,
  NotificationEventType,
  NotificationPreferenceListResult,
  NotificationPreferenceUpsertResult,
  PaymentOnboardingListResult,
  PaymentOnboardingReviewResult,
  PaymentOnboardingSubmitResult,
  PlatformSession,
  PublishedStorefrontConfigResult,
  StorefrontDraftResult,
  StorefrontDraftUpdateResult,
  StorefrontPublishResult,
  StorefrontTemplateCatalogItem,
  StorefrontTemplateSelectionResult,
  SupportHistoryResult,
  SupportNoteCreateResult,
  TenantDomainCreateResult,
  TenantDomainListResult,
  TenantDomainPrimaryResult,
  TenantOnboardingResult,
  TenantReadinessResult,
  TenantShopProvisioningResult,
  TenantStatusUpdateResult,
} from "./app.js";
import { createPlatformApp } from "./app.js";
import type { TenantContext, TenantResolutionResult } from "./tenancy/tenant-resolver.js";

const resolvedTenantContext: TenantContext = {
  tenantId: "tenant_1",
  tenantName: "Abebe Market",
  tenantHandle: "abebe",
  hostname: "abebe.lvh.me",
  domainId: "domain_1",
  status: "active",
  medusaStoreId: "store_1",
  medusaSalesChannelId: "channel_1",
  medusaPublishableKeyId: "pk_1",
  medusaRegionId: "reg_1",
  publishedRevisionId: "revision_1",
  templateId: "template_1",
  templateVersion: 1,
};

function appWithResolution(
  result: TenantResolutionResult,
  options?: {
    authHandler?: (request: Request) => Promise<Response>;
    authorizeDashboardForTenant?: (input: { tenantId: string; userId: string }) => Promise<
      | {
          ok: true;
          actor: {
            id: string;
            email: string;
            name: string | null;
            role: "owner" | "manager" | "staff" | "operator";
          };
        }
      | {
          ok: false;
        }
    >;
    getPublishedStorefrontConfig?: (input: {
      publishedRevisionId: string;
      tenantId: string;
    }) => Promise<PublishedStorefrontConfigResult>;
    handleChapaPaymentCallback?: (input: {
      providerReference?: string | null | undefined;
      reportedStatus?: string | null | undefined;
      tenantId?: string | null | undefined;
      txRef?: string | null | undefined;
    }) => Promise<ChapaPaymentCallbackResult>;
    recordAnalyticsEvent?: (input: {
      customerId?: string | null | undefined;
      eventType: string;
      idempotencyKey?: string | null | undefined;
      occurredAt?: string | null | undefined;
      properties?: unknown;
      sessionId?: string | null | undefined;
      source: "medusa" | "platform" | "storefront";
      subjectId?: string | null | undefined;
      subjectType?: string | null | undefined;
      tenantId: string;
    }) => Promise<AnalyticsEventRecordResult>;
    getSession?: (headers: Headers) => Promise<PlatformSession | null>;
    createMerchantProduct?: (input: {
      handle?: string | null | undefined;
      salesChannelId: string;
      status?: string | null | undefined;
      thumbnail?: string | null | undefined;
      title: string;
    }) => Promise<MerchantProductWriteResult>;
    createTenantShop?: (input: {
      handle: string;
      name: string;
      ownerUserId: string;
    }) => Promise<TenantShopProvisioningResult>;
    createTenantDomain?: (input: {
      hostname: string;
      tenantId: string;
      userId: string;
    }) => Promise<TenantDomainCreateResult>;
    getBillingStatus?: (input: { tenantId: string }) => Promise<BillingStatusResult>;
    getDeliverySettings?: (input: { tenantId: string }) => Promise<DeliverySettingsResult>;
    updateDeliverySettings?: (input: {
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
    }) => Promise<DeliverySettingsUpdateResult>;
    updateBillingInvoiceStatus?: (input: {
      invoiceId: string;
      operatorUserId: string;
      provider?: string | null | undefined;
      providerReference?: string | null | undefined;
      status: string;
      tenantId: string;
    }) => Promise<BillingInvoiceUpdateResult>;
    getTenantOnboarding?: (input: { tenantId: string }) => Promise<TenantOnboardingResult>;
    getTenantReadiness?: (input: { tenantId: string }) => Promise<TenantReadinessResult>;
    getOperatorSupportHistory?: (input: {
      limit: number;
      tenantId: string;
    }) => Promise<SupportHistoryResult>;
    getStorefrontDraft?: (input: { tenantId: string }) => Promise<StorefrontDraftResult>;
    updateStorefrontDraft?: (input: {
      data: unknown;
      tenantId: string;
      themeTokens: unknown;
      userId: string;
    }) => Promise<StorefrontDraftUpdateResult>;
    publishStorefrontDraft?: (input: {
      tenantId: string;
      userId: string;
    }) => Promise<StorefrontPublishResult>;
    createOperatorSupportNote?: (input: {
      body: string;
      operatorUserId: string;
      tenantId: string;
      visibility?: string | null | undefined;
    }) => Promise<SupportNoteCreateResult>;
    updateTenantStatus?: (input: {
      operatorUserId: string;
      reason?: string | null | undefined;
      status: string;
      tenantId: string;
    }) => Promise<TenantStatusUpdateResult>;
    listPaymentOnboarding?: (input: { tenantId: string }) => Promise<PaymentOnboardingListResult>;
    reviewPaymentOnboarding?: (input: {
      notes?: string | null | undefined;
      operatorUserId: string;
      paymentOnboardingId: string;
      providerAccountRef?: string | null | undefined;
      status: string;
      tenantId: string;
    }) => Promise<PaymentOnboardingReviewResult>;
    listTenantDomains?: (input: { tenantId: string }) => Promise<TenantDomainListResult>;
    listMerchantProducts?: (input: {
      limit: number;
      offset: number;
      salesChannelId: string;
    }) => Promise<MerchantProductsResult>;
    listMerchantOrders?: (input: {
      limit: number;
      offset: number;
      salesChannelId: string;
    }) => Promise<MerchantOrdersResult>;
    listNotificationPreferences?: (input: {
      tenantId: string;
    }) => Promise<NotificationPreferenceListResult>;
    listStorefrontTemplates?: () => Promise<StorefrontTemplateCatalogItem[]>;
    medusaStoreFetch?: typeof fetch;
    recordNotificationEvent?: (input: {
      eventType: NotificationEventType;
      payload?: unknown;
      tenantId: string;
    }) => Promise<NotificationEventRecordResult>;
    setTenantPrimaryDomain?: (input: {
      domainId: string;
      tenantId: string;
      userId: string;
    }) => Promise<TenantDomainPrimaryResult>;
    submitPaymentOnboarding?: (input: {
      notes?: string | null | undefined;
      provider: string;
      requiredDocuments: unknown[];
      tenantId: string;
      userId: string;
    }) => Promise<PaymentOnboardingSubmitResult>;
    selectStorefrontTemplate?: (input: {
      tenantId: string;
      templateKey: string;
      userId: string;
    }) => Promise<StorefrontTemplateSelectionResult>;
    upsertNotificationPreference?: (input: {
      channel: string;
      enabled: boolean;
      events: string[];
      target: string;
      tenantId: string;
      userId: string;
    }) => Promise<NotificationPreferenceUpsertResult>;
    updateMerchantProduct?: (input: {
      handle?: string | null | undefined;
      productId: string;
      salesChannelId: string;
      status?: string | null | undefined;
      thumbnail?: string | null | undefined;
      title?: string | null | undefined;
    }) => Promise<MerchantProductWriteResult>;
  },
) {
  return createPlatformApp({
    authHandler: options?.authHandler,
    authorizeDashboardForTenant: options?.authorizeDashboardForTenant,
    createMerchantProduct: options?.createMerchantProduct,
    createTenantDomain: options?.createTenantDomain,
    createOperatorSupportNote: options?.createOperatorSupportNote,
    createTenantShop: options?.createTenantShop,
    getBillingStatus: options?.getBillingStatus,
    getDeliverySettings: options?.getDeliverySettings,
    handleChapaPaymentCallback: options?.handleChapaPaymentCallback,
    getPublishedStorefrontConfig: options?.getPublishedStorefrontConfig,
    getStorefrontDraft: options?.getStorefrontDraft,
    getOperatorSupportHistory: options?.getOperatorSupportHistory,
    getTenantReadiness: options?.getTenantReadiness,
    getTenantOnboarding: options?.getTenantOnboarding,
    getSession: options?.getSession,
    listMerchantProducts: options?.listMerchantProducts,
    listMerchantOrders: options?.listMerchantOrders,
    listNotificationPreferences: options?.listNotificationPreferences,
    listPaymentOnboarding: options?.listPaymentOnboarding,
    reviewPaymentOnboarding: options?.reviewPaymentOnboarding,
    listTenantDomains: options?.listTenantDomains,
    listStorefrontTemplates: options?.listStorefrontTemplates,
    selectStorefrontTemplate: options?.selectStorefrontTemplate,
    updateMerchantProduct: options?.updateMerchantProduct,
    serviceName: "platform-api",
    medusaInternalUrl: "http://medusa:9000",
    platformPublicBaseUrl: "http://api.lvh.me",
    ...(options?.medusaStoreFetch ? { medusaStoreFetch: options.medusaStoreFetch } : {}),
    setTenantPrimaryDomain: options?.setTenantPrimaryDomain,
    submitPaymentOnboarding: options?.submitPaymentOnboarding,
    updateBillingInvoiceStatus: options?.updateBillingInvoiceStatus,
    updateDeliverySettings: options?.updateDeliverySettings,
    publishStorefrontDraft: options?.publishStorefrontDraft,
    recordAnalyticsEvent: options?.recordAnalyticsEvent,
    recordNotificationEvent: options?.recordNotificationEvent,
    upsertNotificationPreference: options?.upsertNotificationPreference,
    updateTenantStatus: options?.updateTenantStatus,
    updateStorefrontDraft: options?.updateStorefrontDraft,
    resolveTenantForHost: async () => result,
  });
}

describe("platform app", () => {
  it("returns health status", async () => {
    const app = appWithResolution({ ok: false, error: "shop_context_required" });

    const response = await app.request("/health");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "platform-api",
    });
  });

  it("adds request ids to platform responses and platform-owned errors", async () => {
    const app = appWithResolution({ ok: false, error: "shop_context_required" });

    const response = await app.request("/platform/me", {
      headers: {
        "x-request-id": "req_test_1",
      },
    });

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("x-request-id"), "req_test_1");
    assert.deepEqual(await response.json(), {
      error: "auth_required",
      requestId: "req_test_1",
    });
  });

  it("handles Chapa payment callbacks with verified payment state", async () => {
    let callbackInput:
      | {
          providerReference?: string | null | undefined;
          reportedStatus?: string | null | undefined;
          tenantId?: string | null | undefined;
          txRef?: string | null | undefined;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        handleChapaPaymentCallback: async (input) => {
          callbackInput = input;

          return {
            ok: true,
            eventType: "payment.paid",
            providerReference: "chapa_ref_1",
            status: "success",
            tenantId: "tenant_1",
            txRef: "tx_1",
          };
        },
      },
    );

    const response = await app.request(
      "/platform/payments/chapa/callback?trx_ref=tx_1&ref_id=chapa_ref_1&status=success&tenant_id=tenant_1",
    );

    assert.equal(response.status, 200);
    assert.deepEqual(callbackInput, {
      providerReference: "chapa_ref_1",
      reportedStatus: "success",
      tenantId: "tenant_1",
      txRef: "tx_1",
    });
    assert.deepEqual(await response.json(), {
      payment: {
        eventType: "payment.paid",
        providerReference: "chapa_ref_1",
        status: "success",
        tenantId: "tenant_1",
        txRef: "tx_1",
      },
    });
  });

  it("rejects Chapa callbacks without tenant context", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        handleChapaPaymentCallback: async () => ({
          ok: false,
          error: "missing_tenant_context",
          status: 400,
        }),
      },
    );

    const response = await app.request("/platform/payments/chapa/callback?trx_ref=tx_1");

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "missing_tenant_context",
    });
  });

  it("returns shop_context_required for central store requests without trusted shop context", async () => {
    const app = appWithResolution({ ok: false, error: "shop_context_required" });

    const response = await app.request("/store/products", {
      headers: {
        Host: "api.lvh.me",
      },
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "shop_context_required",
    });
  });

  it("returns shop_not_found for unknown storefront hosts", async () => {
    const app = appWithResolution({ ok: false, error: "shop_not_found" });

    const response = await app.request("/store/products", {
      headers: {
        Host: "missing.lvh.me",
      },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "shop_not_found",
    });
  });

  it("records storefront analytics events for the resolved host tenant", async () => {
    let recordedEvent:
      | {
          customerId?: string | null | undefined;
          eventType: string;
          idempotencyKey?: string | null | undefined;
          occurredAt?: string | null | undefined;
          properties?: unknown;
          sessionId?: string | null | undefined;
          source: "medusa" | "platform" | "storefront";
          subjectId?: string | null | undefined;
          subjectType?: string | null | undefined;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        recordAnalyticsEvent: async (input) => {
          recordedEvent = input;

          return {
            ok: true,
            duplicate: false,
            event: {
              id: "event_1",
              eventType: "storefront.page_viewed",
              occurredAt: "2026-01-01T12:00:00.000Z",
              receivedAt: "2026-01-01T12:00:01.000Z",
              source: "storefront",
            },
          };
        },
      },
    );

    const response = await app.request("/store/analytics/events", {
      body: JSON.stringify({
        eventType: "storefront.page_viewed",
        idempotencyKey: "view-1",
        occurredAt: "2026-01-01T12:00:00.000Z",
        properties: {
          path: "/products/coffee",
          tenantId: "tenant_from_body_should_be_ignored",
        },
        sessionId: "anonymous-session-1",
        tenantId: "tenant_from_body_should_be_ignored",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 202);
    assert.deepEqual(recordedEvent, {
      customerId: null,
      eventType: "storefront.page_viewed",
      idempotencyKey: "view-1",
      occurredAt: "2026-01-01T12:00:00.000Z",
      properties: {
        path: "/products/coffee",
        tenantId: "tenant_from_body_should_be_ignored",
      },
      sessionId: "anonymous-session-1",
      source: "storefront",
      subjectId: null,
      subjectType: null,
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      event: {
        duplicate: false,
        id: "event_1",
      },
    });
  });

  it("mounts platform auth routes", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authHandler: async (request) =>
          Response.json({
            method: request.method,
            path: new URL(request.url).pathname,
          }),
      },
    );

    const response = await app.request("/platform/auth/get-session");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      method: "GET",
      path: "/platform/auth/get-session",
    });
  });

  it("returns the current platform session user", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
      },
    );

    const response = await app.request("/platform/me");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      user: {
        id: "user_1",
        email: "owner@abebe.local",
        name: "Abebe Owner",
      },
    });
  });

  it("requires a platform session before creating a tenant shop", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        createTenantShop: async () => {
          throw new Error("should not create tenant shop without a session");
        },
      },
    );

    const response = await app.request("/platform/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "New Shop",
        handle: "new-shop",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "auth_required",
    });
  });

  it("validates tenant shop creation input", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: { id: "user_1", email: "owner@example.com", name: "Owner" },
        }),
        createTenantShop: async () => {
          throw new Error("should not create tenant shop with invalid input");
        },
      },
    );

    const response = await app.request("/platform/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "New Shop",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "missing_handle",
    });
  });

  it("creates a tenant shop for the current platform user", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: { id: "user_1", email: "owner@example.com", name: "Owner" },
        }),
        createTenantShop: async (input) => {
          assert.deepEqual(input, {
            name: "New Shop",
            handle: "new-shop",
            ownerUserId: "user_1",
          });

          return {
            ok: true,
            tenant: {
              id: "tenant_2",
              name: "New Shop",
              handle: "new-shop",
              status: "draft",
              primaryDomain: {
                hostname: "new-shop.lvh.me",
              },
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "New Shop",
        handle: "new-shop",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      tenant: {
        id: "tenant_2",
        name: "New Shop",
        handle: "new-shop",
        status: "draft",
        primaryDomain: {
          hostname: "new-shop.lvh.me",
        },
      },
    });
  });

  it("lists active storefront templates", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        listStorefrontTemplates: async () => [
          {
            id: "template_1",
            slug: "classic",
            name: "Classic",
            description: "A clean storefront.",
            previewAssetId: null,
            tags: ["default"],
            minimumPlanId: null,
            version: {
              id: "template_version_1",
              version: 1,
              templateKey: "classic@1",
              previewData: {
                home: {},
              },
            },
          },
        ],
      },
    );

    const response = await app.request("/platform/storefront/templates");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      templates: [
        {
          id: "template_1",
          slug: "classic",
          name: "Classic",
          description: "A clean storefront.",
          previewAssetId: null,
          tags: ["default"],
          minimumPlanId: null,
          version: {
            id: "template_version_1",
            version: 1,
            templateKey: "classic@1",
            previewData: {
              home: {},
            },
          },
        },
      ],
    });
  });

  it("returns the published storefront config for the resolved host", async () => {
    let configInput: { publishedRevisionId: string; tenantId: string } | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getPublishedStorefrontConfig: async (input) => {
          configInput = input;

          return {
            ok: true,
            config: {
              publishedRevisionId: "revision_1",
              templateId: "template_1",
              templateVersion: 1,
              templateKey: "classic@1",
              data: {
                home: {
                  hero: {
                    title: "Abebe Market",
                  },
                },
              },
              themeTokens: {
                colors: {
                  primary: "#0f766e",
                },
              },
              publishedAt: "2026-01-01T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/storefront/config", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(configInput, {
      tenantId: "tenant_1",
      publishedRevisionId: "revision_1",
    });
    assert.deepEqual(await response.json(), {
      tenant: {
        id: "tenant_1",
        name: "Abebe Market",
        handle: "abebe",
        status: "active",
        domain: {
          id: "domain_1",
          hostname: "abebe.lvh.me",
        },
      },
      commerce: {
        regionId: "reg_1",
      },
      storefront: {
        publishedRevisionId: "revision_1",
        templateId: "template_1",
        templateVersion: 1,
        templateKey: "classic@1",
        data: {
          home: {
            hero: {
              title: "Abebe Market",
            },
          },
        },
        themeTokens: {
          colors: {
            primary: "#0f766e",
          },
        },
        publishedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("does not return storefront config without a tenant commerce region", async () => {
    const app = appWithResolution(
      {
        ok: true,
        context: {
          ...resolvedTenantContext,
          medusaRegionId: null,
        },
      },
      {
        getPublishedStorefrontConfig: async () => {
          throw new Error("should not load storefront config without a Medusa region");
        },
      },
    );

    const response = await app.request("/platform/storefront/config", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "commerce_region_unavailable",
    });
  });

  it("does not return draft config for unresolved storefront hosts", async () => {
    let configCalls = 0;
    const app = appWithResolution(
      { ok: false, error: "shop_unpublished" },
      {
        getPublishedStorefrontConfig: async () => {
          configCalls += 1;

          return {
            ok: false,
            error: "published_revision_not_found",
          };
        },
      },
    );

    const response = await app.request("/platform/storefront/config", {
      headers: {
        Host: "draft.lvh.me",
      },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "shop_unpublished",
    });
    assert.equal(configCalls, 0);
  });

  it("requires a platform session before selecting a storefront template", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        selectStorefrontTemplate: async () => ({
          ok: true,
          draft: {
            tenantId: "tenant_1",
            templateId: "template_1",
            templateVersion: 1,
            templateKey: "classic@1",
          },
        }),
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/storefront/template/select", {
      body: JSON.stringify({ templateKey: "classic@1" }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "auth_required",
    });
  });

  it("selects a storefront template draft for an authorized tenant member", async () => {
    let selectionInput: { tenantId: string; templateKey: string; userId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        selectStorefrontTemplate: async (input) => {
          selectionInput = input;

          return {
            ok: true,
            draft: {
              tenantId: input.tenantId,
              templateId: "template_1",
              templateVersion: 1,
              templateKey: input.templateKey,
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/storefront/template/select", {
      body: JSON.stringify({ templateKey: " classic@1 " }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(selectionInput, {
      tenantId: "tenant_1",
      templateKey: "classic@1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      draft: {
        tenantId: "tenant_1",
        templateId: "template_1",
        templateVersion: 1,
        templateKey: "classic@1",
      },
    });
  });

  it("returns the storefront draft for an authorized tenant member", async () => {
    let draftInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getStorefrontDraft: async (input) => {
          draftInput = input;

          return {
            ok: true,
            draft: {
              tenantId: input.tenantId,
              templateId: "template_1",
              templateVersion: 1,
              templateKey: "classic@1",
              data: {
                heroTitle: "Abebe Market",
              },
              themeTokens: {
                color: "green",
              },
              updatedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/storefront/draft");

    assert.equal(response.status, 200);
    assert.deepEqual(draftInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      draft: {
        tenantId: "tenant_1",
        templateId: "template_1",
        templateVersion: 1,
        templateKey: "classic@1",
        data: {
          heroTitle: "Abebe Market",
        },
        themeTokens: {
          color: "green",
        },
        updatedAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("updates the storefront draft for an authorized tenant member", async () => {
    let draftInput:
      | {
          data: unknown;
          tenantId: string;
          themeTokens: unknown;
          userId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        updateStorefrontDraft: async (input) => {
          draftInput = input;

          return {
            ok: true,
            draft: {
              tenantId: input.tenantId,
              templateId: "template_1",
              templateVersion: 1,
              templateKey: "classic@1",
              data: input.data,
              themeTokens: input.themeTokens,
              updatedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/storefront/draft", {
      body: JSON.stringify({
        data: {
          heroTitle: "Updated Market",
        },
        themeTokens: {
          color: "blue",
        },
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "PUT",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(draftInput, {
      tenantId: "tenant_1",
      userId: "user_1",
      data: {
        heroTitle: "Updated Market",
      },
      themeTokens: {
        color: "blue",
      },
    });
    assert.deepEqual(await response.json(), {
      draft: {
        tenantId: "tenant_1",
        templateId: "template_1",
        templateVersion: 1,
        templateKey: "classic@1",
        data: {
          heroTitle: "Updated Market",
        },
        themeTokens: {
          color: "blue",
        },
        updatedAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("publishes the storefront draft for an authorized tenant member", async () => {
    let publishInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        publishStorefrontDraft: async (input) => {
          publishInput = input;

          return {
            ok: true,
            storefront: {
              publishedRevisionId: "revision_2",
              tenantId: input.tenantId,
              templateId: "template_1",
              templateVersion: 1,
              templateKey: "classic@1",
              publishedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/storefront/publish", {
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(publishInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      storefront: {
        tenantId: "tenant_1",
        publishedRevisionId: "revision_2",
        templateId: "template_1",
        templateVersion: 1,
        templateKey: "classic@1",
        publishedAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("returns delivery settings for an authorized tenant member", async () => {
    let deliveryInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getDeliverySettings: async (input) => {
          deliveryInput = input;

          return {
            ok: true,
            delivery: {
              tenantId: input.tenantId,
              deliveryEnabled: true,
              pickupEnabled: true,
              phoneConfirmationRequired: true,
              notesEnabled: true,
              landmarkRequired: false,
              defaultDeliveryFee: "50.00",
              currency: "ETB",
              zones: [
                {
                  name: "Bole",
                  fee: "75.00",
                },
              ],
              updatedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/delivery");

    assert.equal(response.status, 200);
    assert.deepEqual(deliveryInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      delivery: {
        tenantId: "tenant_1",
        deliveryEnabled: true,
        pickupEnabled: true,
        phoneConfirmationRequired: true,
        notesEnabled: true,
        landmarkRequired: false,
        defaultDeliveryFee: "50.00",
        currency: "ETB",
        zones: [
          {
            name: "Bole",
            fee: "75.00",
          },
        ],
        updatedAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("updates delivery settings for an authorized tenant member", async () => {
    let deliveryInput:
      | {
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
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        updateDeliverySettings: async (input) => {
          deliveryInput = input;

          return {
            ok: true,
            delivery: {
              tenantId: input.tenantId,
              deliveryEnabled: input.deliveryEnabled,
              pickupEnabled: input.pickupEnabled,
              phoneConfirmationRequired: input.phoneConfirmationRequired,
              notesEnabled: input.notesEnabled,
              landmarkRequired: input.landmarkRequired,
              defaultDeliveryFee: input.defaultDeliveryFee,
              currency: input.currency,
              zones: input.zones,
              updatedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
      },
    );

    const body = {
      deliveryEnabled: true,
      pickupEnabled: false,
      phoneConfirmationRequired: true,
      notesEnabled: true,
      landmarkRequired: true,
      defaultDeliveryFee: 75,
      currency: " etb ",
      zones: [
        {
          name: "Bole",
          fee: "75.00",
        },
      ],
    };

    const response = await app.request("/platform/tenants/tenant_1/delivery", {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
      },
      method: "PUT",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(deliveryInput, {
      tenantId: "tenant_1",
      userId: "user_1",
      deliveryEnabled: true,
      pickupEnabled: false,
      phoneConfirmationRequired: true,
      notesEnabled: true,
      landmarkRequired: true,
      defaultDeliveryFee: "75",
      currency: "ETB",
      zones: [
        {
          name: "Bole",
          fee: "75.00",
        },
      ],
    });
    assert.deepEqual(await response.json(), {
      delivery: {
        tenantId: "tenant_1",
        deliveryEnabled: true,
        pickupEnabled: false,
        phoneConfirmationRequired: true,
        notesEnabled: true,
        landmarkRequired: true,
        defaultDeliveryFee: "75",
        currency: "ETB",
        zones: [
          {
            name: "Bole",
            fee: "75.00",
          },
        ],
        updatedAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("rejects template selection for a tenant without active membership", async () => {
    let selectCalls = 0;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({ ok: false }),
        getSession: async () => ({
          user: {
            id: "user_2",
            email: "stranger@example.com",
            name: "Stranger",
          },
        }),
        selectStorefrontTemplate: async () => {
          selectCalls += 1;

          return {
            ok: false,
            error: "template_not_found",
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/storefront/template/select", {
      body: JSON.stringify({ templateKey: "classic@1" }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "dashboard_forbidden",
    });
    assert.equal(selectCalls, 0);
  });

  it("returns onboarding state for an authorized tenant member", async () => {
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let onboardingInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async (input) => {
          authorizationInput = input;

          return {
            ok: true,
            actor: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
              role: "owner",
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantOnboarding: async (input) => {
          onboardingInput = input;

          return {
            ok: true,
            onboarding: {
              tenantId: input.tenantId,
              status: "in_progress",
              currentStep: "storefront_review",
              completedSteps: ["commerce_resources_provisioned", "storefront_template_preselected"],
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/onboarding");

    assert.equal(response.status, 200);
    assert.deepEqual(authorizationInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(onboardingInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      onboarding: {
        tenantId: "tenant_1",
        status: "in_progress",
        currentStep: "storefront_review",
        completedSteps: ["commerce_resources_provisioned", "storefront_template_preselected"],
      },
    });
  });

  it("lists domains for an authorized tenant member", async () => {
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let listInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async (input) => {
          authorizationInput = input;

          return {
            ok: true,
            actor: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
              role: "owner",
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        listTenantDomains: async (input) => {
          listInput = input;

          return {
            ok: true,
            domains: [
              {
                id: "domain_1",
                hostname: "abebe.lvh.me",
                type: "platform_subdomain",
                status: "active",
                isPrimary: true,
                verificationStatus: "verified",
                sslStatus: "active",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/domains");

    assert.equal(response.status, 200);
    assert.deepEqual(authorizationInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(listInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      domains: [
        {
          id: "domain_1",
          hostname: "abebe.lvh.me",
          type: "platform_subdomain",
          status: "active",
          isPrimary: true,
          verificationStatus: "verified",
          sslStatus: "active",
        },
      ],
    });
  });

  it("adds a custom domain for an authorized tenant member", async () => {
    let createInput:
      | {
          hostname: string;
          tenantId: string;
          userId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        createTenantDomain: async (input) => {
          createInput = input;

          return {
            ok: true,
            domain: {
              id: "domain_2",
              hostname: "shop.example.com",
              type: "custom_domain",
              status: "pending_verification",
              isPrimary: false,
              verificationStatus: "pending",
              sslStatus: "pending",
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/domains", {
      body: JSON.stringify({ hostname: " Shop.Example.com " }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 201);
    assert.deepEqual(createInput, {
      hostname: "Shop.Example.com",
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      domain: {
        id: "domain_2",
        hostname: "shop.example.com",
        type: "custom_domain",
        status: "pending_verification",
        isPrimary: false,
        verificationStatus: "pending",
        sslStatus: "pending",
      },
    });
  });

  it("sets a verified domain as the tenant primary domain", async () => {
    let primaryInput:
      | {
          domainId: string;
          tenantId: string;
          userId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        setTenantPrimaryDomain: async (input) => {
          primaryInput = input;

          return {
            ok: true,
            domain: {
              id: input.domainId,
              hostname: "shop.example.com",
              type: "custom_domain",
              status: "active",
              isPrimary: true,
              verificationStatus: "verified",
              sslStatus: "active",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/domains/domain_2/primary", {
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(primaryInput, {
      domainId: "domain_2",
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      domain: {
        id: "domain_2",
        hostname: "shop.example.com",
        type: "custom_domain",
        status: "active",
        isPrimary: true,
        verificationStatus: "verified",
        sslStatus: "active",
      },
    });
  });

  it("lists payment onboarding records for an authorized tenant member", async () => {
    let listInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        listPaymentOnboarding: async (input) => {
          listInput = input;

          return {
            ok: true,
            paymentOnboarding: [
              {
                id: "payment_onboarding_1",
                provider: "chapa",
                status: "needs_review",
                requiredDocuments: ["business_license"],
                notes: "License uploaded.",
                providerAccountRef: null,
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/payments");

    assert.equal(response.status, 200);
    assert.deepEqual(listInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      paymentOnboarding: [
        {
          id: "payment_onboarding_1",
          provider: "chapa",
          status: "needs_review",
          requiredDocuments: ["business_license"],
          notes: "License uploaded.",
          providerAccountRef: null,
        },
      ],
    });
  });

  it("submits payment onboarding for operator review", async () => {
    let submitInput:
      | {
          notes?: string | null | undefined;
          provider: string;
          requiredDocuments: unknown[];
          tenantId: string;
          userId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        submitPaymentOnboarding: async (input) => {
          submitInput = input;

          return {
            ok: true,
            paymentOnboarding: {
              id: "payment_onboarding_1",
              provider: "chapa",
              status: "needs_review",
              requiredDocuments: ["business_license"],
              notes: input.notes ?? null,
              providerAccountRef: null,
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/payments/onboarding", {
      body: JSON.stringify({
        provider: " Chapa ",
        requiredDocuments: ["business_license"],
        notes: " License uploaded. ",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(submitInput, {
      tenantId: "tenant_1",
      userId: "user_1",
      provider: "Chapa",
      requiredDocuments: ["business_license"],
      notes: "License uploaded.",
    });
    assert.deepEqual(await response.json(), {
      paymentOnboarding: {
        id: "payment_onboarding_1",
        provider: "chapa",
        status: "needs_review",
        requiredDocuments: ["business_license"],
        notes: "License uploaded.",
        providerAccountRef: null,
      },
    });
  });

  it("returns billing status for an authorized tenant member", async () => {
    let billingInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getBillingStatus: async (input) => {
          billingInput = input;

          return {
            ok: true,
            billing: {
              subscription: {
                id: "subscription_1",
                status: "active",
                billingCycle: "monthly",
                manualPaymentState: "paid",
                currentPeriodStart: "2026-06-01T00:00:00.000Z",
                currentPeriodEnd: "2026-07-01T00:00:00.000Z",
              },
              plan: {
                id: "plan_1",
                name: "Starter",
                price: "999.00",
                limits: {
                  products: 100,
                },
                features: {
                  customDomain: false,
                },
              },
              invoices: [
                {
                  id: "invoice_1",
                  amount: "999.00",
                  currency: "ETB",
                  status: "paid",
                  dueAt: "2026-06-05T00:00:00.000Z",
                  paidAt: "2026-06-02T00:00:00.000Z",
                  provider: "manual",
                  providerReference: "receipt_1",
                  createdAt: "2026-06-01T00:00:00.000Z",
                },
              ],
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/billing");

    assert.equal(response.status, 200);
    assert.deepEqual(billingInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      billing: {
        subscription: {
          id: "subscription_1",
          status: "active",
          billingCycle: "monthly",
          manualPaymentState: "paid",
          currentPeriodStart: "2026-06-01T00:00:00.000Z",
          currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        },
        plan: {
          id: "plan_1",
          name: "Starter",
          price: "999.00",
          limits: {
            products: 100,
          },
          features: {
            customDomain: false,
          },
        },
        invoices: [
          {
            id: "invoice_1",
            amount: "999.00",
            currency: "ETB",
            status: "paid",
            dueAt: "2026-06-05T00:00:00.000Z",
            paidAt: "2026-06-02T00:00:00.000Z",
            provider: "manual",
            providerReference: "receipt_1",
            createdAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
    });
  });

  it("lets an operator review tenant payment onboarding", async () => {
    let reviewInput:
      | {
          notes?: string | null | undefined;
          operatorUserId: string;
          paymentOnboardingId: string;
          providerAccountRef?: string | null | undefined;
          status: string;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        getSession: async () => ({
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
        reviewPaymentOnboarding: async (input) => {
          reviewInput = input;

          return {
            ok: true,
            paymentOnboarding: {
              id: input.paymentOnboardingId,
              provider: "chapa",
              status: input.status,
              requiredDocuments: ["business_license"],
              notes: input.notes ?? null,
              providerAccountRef: input.providerAccountRef ?? null,
            },
          };
        },
      },
    );

    const response = await app.request(
      "/platform/operator/tenants/tenant_1/payments/onboarding/payment_onboarding_1/review",
      {
        body: JSON.stringify({
          status: " approved ",
          notes: " Approved after license check. ",
          providerAccountRef: " chapa_subaccount_1 ",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(reviewInput, {
      tenantId: "tenant_1",
      operatorUserId: "operator_1",
      paymentOnboardingId: "payment_onboarding_1",
      status: "approved",
      notes: "Approved after license check.",
      providerAccountRef: "chapa_subaccount_1",
    });
    assert.deepEqual(await response.json(), {
      paymentOnboarding: {
        id: "payment_onboarding_1",
        provider: "chapa",
        status: "approved",
        requiredDocuments: ["business_license"],
        notes: "Approved after license check.",
        providerAccountRef: "chapa_subaccount_1",
      },
    });
  });

  it("lets an operator update a tenant billing invoice status", async () => {
    let updateInput:
      | {
          invoiceId: string;
          operatorUserId: string;
          provider?: string | null | undefined;
          providerReference?: string | null | undefined;
          status: string;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        getSession: async () => ({
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
        updateBillingInvoiceStatus: async (input) => {
          updateInput = input;

          return {
            ok: true,
            invoice: {
              id: input.invoiceId,
              amount: "999.00",
              currency: "ETB",
              status: input.status,
              dueAt: "2026-06-05T00:00:00.000Z",
              paidAt: "2026-06-02T00:00:00.000Z",
              provider: input.provider ?? null,
              providerReference: input.providerReference ?? null,
              createdAt: "2026-06-01T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request(
      "/platform/operator/tenants/tenant_1/billing/invoices/invoice_1/status",
      {
        body: JSON.stringify({
          status: " paid ",
          provider: " manual ",
          providerReference: " receipt_1 ",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(updateInput, {
      tenantId: "tenant_1",
      operatorUserId: "operator_1",
      invoiceId: "invoice_1",
      status: "paid",
      provider: "manual",
      providerReference: "receipt_1",
    });
    assert.deepEqual(await response.json(), {
      invoice: {
        id: "invoice_1",
        amount: "999.00",
        currency: "ETB",
        status: "paid",
        dueAt: "2026-06-05T00:00:00.000Z",
        paidAt: "2026-06-02T00:00:00.000Z",
        provider: "manual",
        providerReference: "receipt_1",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    });
  });

  it("lets an operator suspend a tenant", async () => {
    let updateInput:
      | {
          operatorUserId: string;
          reason?: string | null | undefined;
          status: string;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        getSession: async () => ({
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
        updateTenantStatus: async (input) => {
          updateInput = input;

          return {
            ok: true,
            tenant: {
              id: input.tenantId,
              name: "Abebe Market",
              handle: "abebe",
              status: input.status,
            },
          };
        },
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/status", {
      body: JSON.stringify({
        status: " suspended ",
        reason: " Past due billing. ",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(updateInput, {
      tenantId: "tenant_1",
      operatorUserId: "operator_1",
      status: "suspended",
      reason: "Past due billing.",
    });
    assert.deepEqual(await response.json(), {
      tenant: {
        id: "tenant_1",
        name: "Abebe Market",
        handle: "abebe",
        status: "suspended",
      },
    });
  });

  it("returns operator support history for a tenant", async () => {
    let historyInput: { limit: number; tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        getOperatorSupportHistory: async (input) => {
          historyInput = input;

          return {
            ok: true,
            history: {
              notes: [
                {
                  id: "note_1",
                  operatorUserId: "operator_1",
                  body: "Called merchant about billing.",
                  visibility: "internal",
                  createdAt: "2026-06-02T10:00:00.000Z",
                },
              ],
              auditLogs: [
                {
                  id: "audit_1",
                  actorUserId: "operator_1",
                  action: "tenant.status_changed",
                  targetType: "tenant",
                  targetId: "tenant_1",
                  metadata: {
                    status: "suspended",
                  },
                  createdAt: "2026-06-02T11:00:00.000Z",
                },
              ],
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/support?limit=5");

    assert.equal(response.status, 200);
    assert.deepEqual(historyInput, {
      tenantId: "tenant_1",
      limit: 5,
    });
    assert.deepEqual(await response.json(), {
      history: {
        notes: [
          {
            id: "note_1",
            operatorUserId: "operator_1",
            body: "Called merchant about billing.",
            visibility: "internal",
            createdAt: "2026-06-02T10:00:00.000Z",
          },
        ],
        auditLogs: [
          {
            id: "audit_1",
            actorUserId: "operator_1",
            action: "tenant.status_changed",
            targetType: "tenant",
            targetId: "tenant_1",
            metadata: {
              status: "suspended",
            },
            createdAt: "2026-06-02T11:00:00.000Z",
          },
        ],
      },
    });
  });

  it("lets an operator add a tenant support note", async () => {
    let noteInput:
      | {
          body: string;
          operatorUserId: string;
          tenantId: string;
          visibility?: string | null | undefined;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        createOperatorSupportNote: async (input) => {
          noteInput = input;

          return {
            ok: true,
            note: {
              id: "note_1",
              operatorUserId: input.operatorUserId,
              body: input.body,
              visibility: input.visibility ?? "internal",
              createdAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/support/notes", {
      body: JSON.stringify({
        body: " Called merchant about billing. ",
        visibility: " internal ",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 201);
    assert.deepEqual(noteInput, {
      tenantId: "tenant_1",
      operatorUserId: "operator_1",
      body: "Called merchant about billing.",
      visibility: "internal",
    });
    assert.deepEqual(await response.json(), {
      note: {
        id: "note_1",
        operatorUserId: "operator_1",
        body: "Called merchant about billing.",
        visibility: "internal",
        createdAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("returns a merchant dashboard summary for the resolved shop host", async () => {
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async (input) => {
          authorizationInput = input;

          return {
            ok: true,
            actor: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
              role: "owner",
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
      },
    );

    const response = await app.request("/platform/merchant/dashboard", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(authorizationInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      tenant: {
        id: "tenant_1",
        name: "Abebe Market",
        handle: "abebe",
        status: "active",
      },
      domain: {
        id: "domain_1",
        hostname: "abebe.lvh.me",
      },
      actor: {
        id: "user_1",
        email: "owner@abebe.local",
        name: "Abebe Owner",
        role: "owner",
      },
      commerce: {
        hasPublishableKey: true,
        hasSalesChannel: true,
        hasStore: true,
      },
      storefront: {
        isPublished: true,
        publishedRevisionId: "revision_1",
        templateId: "template_1",
        templateVersion: 1,
      },
    });
  });

  it("returns tenant readiness for an authorized tenant member", async () => {
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let readinessInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async (input) => {
          authorizationInput = input;

          return {
            ok: true,
            actor: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
              role: "owner",
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantReadiness: async (input) => {
          readinessInput = input;

          return {
            ok: true,
            readiness: {
              ready: false,
              missing: ["commerce_region_missing", "storefront_unpublished"],
              tenant: {
                id: input.tenantId,
                name: "Abebe Market",
                handle: "abebe",
                status: "active",
              },
              checks: {
                tenant: {
                  ready: true,
                  missing: [],
                  isActive: true,
                },
                domain: {
                  ready: true,
                  missing: [],
                  hasPrimaryDomain: true,
                  isActive: true,
                  isVerified: true,
                },
                commerce: {
                  ready: false,
                  missing: ["commerce_region_missing"],
                  hasStore: true,
                  hasSalesChannel: true,
                  hasPublishableKey: true,
                  hasRegion: false,
                  hasShippingOption: true,
                },
                storefront: {
                  ready: false,
                  missing: ["storefront_unpublished"],
                  hasDraft: true,
                  isPublished: false,
                },
              },
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/readiness", {
      headers: {
        Host: "api.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(authorizationInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(readinessInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      readiness: {
        ready: false,
        missing: ["commerce_region_missing", "storefront_unpublished"],
        tenant: {
          id: "tenant_1",
          name: "Abebe Market",
          handle: "abebe",
          status: "active",
        },
        checks: {
          tenant: {
            ready: true,
            missing: [],
            isActive: true,
          },
          domain: {
            ready: true,
            missing: [],
            hasPrimaryDomain: true,
            isActive: true,
            isVerified: true,
          },
          commerce: {
            ready: false,
            missing: ["commerce_region_missing"],
            hasStore: true,
            hasSalesChannel: true,
            hasPublishableKey: true,
            hasRegion: false,
            hasShippingOption: true,
          },
          storefront: {
            ready: false,
            missing: ["storefront_unpublished"],
            hasDraft: true,
            isPublished: false,
          },
        },
      },
    });
  });

  it("requires a platform session for merchant dashboard access", async () => {
    const app = appWithResolution({
      ok: true,
      context: resolvedTenantContext,
    });

    const response = await app.request("/platform/merchant/dashboard", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "auth_required",
    });
  });

  it("lists merchant notification preferences for the resolved tenant", async () => {
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "member_1",
            email: "owner@example.com",
            name: "Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@example.com", name: "Owner" },
        }),
        listNotificationPreferences: async (input) => {
          assert.equal(input.tenantId, "tenant_1");

          return {
            ok: true,
            preferences: [
              {
                id: "np_1",
                channel: "telegram",
                enabled: true,
                events: ["cod_order.created", "order.created"],
                target: "@abebe_market",
                updatedAt: "2026-06-02T10:00:00.000Z",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/notifications/preferences", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      preferences: [
        {
          id: "np_1",
          channel: "telegram",
          enabled: true,
          events: ["cod_order.created", "order.created"],
          target: "@abebe_market",
          updatedAt: "2026-06-02T10:00:00.000Z",
        },
      ],
    });
  });

  it("upserts merchant notification preferences for the resolved tenant", async () => {
    const upserts: {
      channel: string;
      enabled: boolean;
      events: string[];
      target: string;
      tenantId: string;
      userId: string;
    }[] = [];
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "member_1",
            email: "owner@example.com",
            name: "Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@example.com", name: "Owner" },
        }),
        upsertNotificationPreference: async (input) => {
          upserts.push(input);

          return {
            ok: true,
            preference: {
              id: "np_1",
              channel: input.channel,
              enabled: input.enabled,
              events: input.events,
              target: input.target,
              updatedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/notifications/preferences", {
      body: JSON.stringify({
        channel: "telegram",
        enabled: true,
        events: ["cod_order.created", "order.created"],
        target: "@abebe_market",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(upserts, [
      {
        channel: "telegram",
        enabled: true,
        events: ["cod_order.created", "order.created"],
        target: "@abebe_market",
        tenantId: "tenant_1",
        userId: "user_1",
      },
    ]);
    assert.deepEqual(await response.json(), {
      preference: {
        id: "np_1",
        channel: "telegram",
        enabled: true,
        events: ["cod_order.created", "order.created"],
        target: "@abebe_market",
        updatedAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("rejects actors without active membership for the resolved tenant", async () => {
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({ ok: false }),
        getSession: async () => ({
          user: {
            id: "user_2",
            email: "stranger@example.com",
            name: "Stranger",
          },
        }),
      },
    );

    const response = await app.request("/platform/merchant/dashboard", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "dashboard_forbidden",
    });
  });

  it("lists merchant orders scoped to the resolved tenant sales channel", async () => {
    let ordersInput:
      | {
          limit: number;
          offset: number;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        listMerchantOrders: async (input) => {
          ordersInput = input;

          return {
            ok: true,
            count: 1,
            limit: input.limit,
            offset: input.offset,
            orders: [
              {
                id: "order_1",
                displayId: 1001,
                email: "customer@example.com",
                status: "pending",
                paymentStatus: "awaiting",
                fulfillmentStatus: "not_fulfilled",
                currencyCode: "etb",
                total: 1250,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/orders?limit=5&offset=10", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(ordersInput, {
      limit: 5,
      offset: 10,
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      orders: [
        {
          id: "order_1",
          displayId: 1001,
          email: "customer@example.com",
          status: "pending",
          paymentStatus: "awaiting",
          fulfillmentStatus: "not_fulfilled",
          currencyCode: "etb",
          total: 1250,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 1,
      limit: 5,
      offset: 10,
    });
  });

  it("requires a platform session for merchant order access", async () => {
    const app = appWithResolution({
      ok: true,
      context: resolvedTenantContext,
    });

    const response = await app.request("/platform/merchant/orders", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "auth_required",
    });
  });

  it("lists merchant products scoped to the resolved tenant sales channel", async () => {
    let productsInput:
      | {
          limit: number;
          offset: number;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        listMerchantProducts: async (input) => {
          productsInput = input;

          return {
            ok: true,
            count: 1,
            limit: input.limit,
            offset: input.offset,
            products: [
              {
                id: "prod_1",
                title: "Coffee",
                handle: "coffee",
                status: "published",
                thumbnail: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products?limit=5&offset=10", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(productsInput, {
      limit: 5,
      offset: 10,
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      products: [
        {
          id: "prod_1",
          title: "Coffee",
          handle: "coffee",
          status: "published",
          thumbnail: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 1,
      limit: 5,
      offset: 10,
    });
  });

  it("creates merchant products scoped to the resolved tenant sales channel", async () => {
    let productInput:
      | {
          handle?: string | null | undefined;
          salesChannelId: string;
          status?: string | null | undefined;
          thumbnail?: string | null | undefined;
          title: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        createMerchantProduct: async (input) => {
          productInput = input;

          return {
            ok: true,
            product: {
              id: "prod_1",
              title: input.title,
              handle: input.handle ?? null,
              status: input.status ?? "draft",
              thumbnail: input.thumbnail ?? null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products", {
      body: JSON.stringify({
        title: "Coffee",
        handle: "coffee",
        status: "draft",
        thumbnail: "",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(productInput, {
      title: "Coffee",
      handle: "coffee",
      status: "draft",
      thumbnail: null,
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      product: {
        id: "prod_1",
        title: "Coffee",
        handle: "coffee",
        status: "draft",
        thumbnail: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("rejects merchant product creation without a title", async () => {
    let productCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        createMerchantProduct: async () => {
          productCalls += 1;

          return {
            ok: false,
            error: "commerce_backend_unavailable",
            status: 503,
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products", {
      body: JSON.stringify({ title: " " }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "missing_title",
    });
    assert.equal(productCalls, 0);
  });

  it("updates merchant products scoped to the resolved tenant sales channel", async () => {
    let productInput:
      | {
          handle?: string | null | undefined;
          productId: string;
          salesChannelId: string;
          status?: string | null | undefined;
          thumbnail?: string | null | undefined;
          title?: string | null | undefined;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        updateMerchantProduct: async (input) => {
          productInput = input;

          return {
            ok: true,
            product: {
              id: input.productId,
              title: input.title ?? null,
              handle: input.handle ?? null,
              status: input.status ?? null,
              thumbnail: input.thumbnail ?? null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-03T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products/prod_1", {
      body: JSON.stringify({
        title: "Updated coffee",
        handle: "updated-coffee",
        status: "published",
        thumbnail: "",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(productInput, {
      productId: "prod_1",
      title: "Updated coffee",
      handle: "updated-coffee",
      status: "published",
      thumbnail: null,
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      product: {
        id: "prod_1",
        title: "Updated coffee",
        handle: "updated-coffee",
        status: "published",
        thumbnail: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    });
  });

  it("requires a platform session for merchant product access", async () => {
    const app = appWithResolution({
      ok: true,
      context: resolvedTenantContext,
    });

    const response = await app.request("/platform/merchant/products", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "auth_required",
    });
  });

  it("rejects product access without active membership for the resolved tenant", async () => {
    let productCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({ ok: false }),
        getSession: async () => ({
          user: {
            id: "user_2",
            email: "stranger@example.com",
            name: "Stranger",
          },
        }),
        listMerchantProducts: async () => {
          productCalls += 1;

          return {
            ok: true,
            count: 0,
            limit: 20,
            offset: 0,
            products: [],
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/products", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "dashboard_forbidden",
    });
    assert.equal(productCalls, 0);
  });

  it("forwards resolved store requests to Medusa with the tenant publishable key", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json(
        {
          products: [],
        },
        {
          status: 200,
          headers: {
            "x-medusa-request-id": "medusa_req_1",
          },
        },
      );
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/products?limit=10", {
      headers: {
        Host: "abebe.lvh.me",
        "x-publishable-api-key": "client_supplied_key",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      products: [],
    });
    assert.equal(response.headers.get("x-medusa-request-id"), "medusa_req_1");
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/products?limit=10");
    assert.equal(forwardedRequest.headers.get("x-publishable-api-key"), "pk_1");
    assert.equal(forwardedRequest.headers.get("host"), null);
  });

  it("injects the resolved tenant region when forwarding cart creation", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);
      return Response.json({ cart: { id: "cart_1" } }, { status: 201 });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/carts", {
      method: "POST",
      body: JSON.stringify({ region_id: "reg_other", email: "buyer@example.com" }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 201);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.deepEqual(JSON.parse(await forwardedRequest.text()), {
      region_id: "reg_1",
      email: "buyer@example.com",
    });
  });

  it("does not create carts for tenants without a commerce region", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: {
          ...resolvedTenantContext,
          medusaRegionId: null,
        },
      },
      {
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/carts", {
      method: "POST",
      body: JSON.stringify({ email: "buyer@example.com" }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "commerce_region_unavailable",
    });
    assert.equal(fetchCalls, 0);
  });

  it("returns public delivery options for the resolved storefront host", async () => {
    let deliveryInput: { tenantId: string } | undefined;
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getDeliverySettings: async (input) => {
          deliveryInput = input;

          return {
            ok: true,
            delivery: {
              tenantId: input.tenantId,
              deliveryEnabled: true,
              pickupEnabled: true,
              phoneConfirmationRequired: true,
              notesEnabled: true,
              landmarkRequired: false,
              defaultDeliveryFee: "50.00",
              currency: "ETB",
              zones: [
                {
                  name: "Bole",
                  fee: "75.00",
                },
              ],
              updatedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/delivery", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(deliveryInput, {
      tenantId: "tenant_1",
    });
    assert.equal(fetchCalls, 0);
    assert.deepEqual(await response.json(), {
      delivery: {
        deliveryEnabled: true,
        pickupEnabled: true,
        phoneConfirmationRequired: true,
        notesEnabled: true,
        landmarkRequired: false,
        defaultDeliveryFee: "50.00",
        currency: "ETB",
        zones: [
          {
            name: "Bole",
            fee: "75.00",
          },
        ],
      },
    });
  });

  it("forwards cart shipping option reads to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        shipping_options: [
          {
            id: "so_1",
            name: "Local delivery",
            amount: 50,
          },
        ],
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/shipping-options?cart_id=cart_1", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      shipping_options: [
        {
          id: "so_1",
          name: "Local delivery",
          amount: 50,
        },
      ],
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/shipping-options?cart_id=cart_1");
    assert.equal(forwardedRequest.headers.get("x-publishable-api-key"), "pk_1");
  });

  it("forwards cart shipping method selection to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        cart: {
          id: "cart_1",
          shipping_methods: [
            {
              shipping_option_id: "so_1",
            },
          ],
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/carts/cart_1/shipping-methods", {
      body: JSON.stringify({
        option_id: "so_1",
        data: {
          delivery_choice: "delivery",
        },
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      cart: {
        id: "cart_1",
        shipping_methods: [
          {
            shipping_option_id: "so_1",
          },
        ],
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/carts/cart_1/shipping-methods");
    assert.equal(
      await forwardedRequest.text(),
      JSON.stringify({
        option_id: "so_1",
        data: {
          delivery_choice: "delivery",
        },
      }),
    );
  });

  it("forwards cart contact and address updates to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        cart: {
          id: "cart_1",
          email: "buyer@example.com",
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const body = {
      email: "buyer@example.com",
      shipping_address: {
        first_name: "Abebe",
        phone: "+251911111111",
        address_1: "Bole",
        city: "Addis Ababa",
        country_code: "et",
      },
      metadata: {
        delivery_choice: "delivery",
        landmark: "Near the mall",
        customer_notes: "Call before delivery",
      },
    };

    const response = await app.request("/store/carts/cart_1", {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      cart: {
        id: "cart_1",
        email: "buyer@example.com",
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/carts/cart_1");
    assert.equal(await forwardedRequest.text(), JSON.stringify(body));
  });

  it("forwards payment provider reads to Medusa with the resolved tenant region", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        payment_providers: [
          {
            id: "pp_system_default",
          },
        ],
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/payment-providers?region_id=reg_other", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      payment_providers: [
        {
          id: "pp_system_default",
        },
      ],
    });
    assert.ok(forwardedRequest);
    assert.equal(
      forwardedRequest.url,
      "http://medusa:9000/store/payment-providers?region_id=reg_1",
    );
    assert.equal(forwardedRequest.headers.get("x-publishable-api-key"), "pk_1");
  });

  it("completes a COD checkout through Medusa with tenant delivery metadata", async () => {
    const forwardedRequests: Request[] = [];
    const notificationEvents: {
      eventType: NotificationEventType;
      payload?: unknown;
      tenantId: string;
    }[] = [];
    const analyticsEvents: {
      eventType: string;
      idempotencyKey?: string | null | undefined;
      properties?: unknown;
      source: "medusa" | "platform" | "storefront";
      subjectId?: string | null | undefined;
      subjectType?: string | null | undefined;
      tenantId: string;
    }[] = [];
    const medusaStoreFetch: typeof fetch = async (request) => {
      const forwardedRequest = request instanceof Request ? request : new Request(request);
      forwardedRequests.push(forwardedRequest.clone());
      const path = new URL(forwardedRequest.url).pathname;

      if (path === "/store/payment-collections") {
        return Response.json({
          payment_collection: {
            id: "paycol_1",
          },
        });
      }

      if (path === "/store/carts/cart_1/complete") {
        return Response.json({
          type: "order",
          order: {
            id: "order_1",
          },
        });
      }

      return Response.json({
        cart: {
          id: "cart_1",
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getDeliverySettings: async (input) => ({
          ok: true,
          delivery: {
            tenantId: input.tenantId,
            deliveryEnabled: true,
            pickupEnabled: true,
            phoneConfirmationRequired: true,
            notesEnabled: true,
            landmarkRequired: true,
            defaultDeliveryFee: "50.00",
            currency: "ETB",
            zones: [],
            updatedAt: "2026-06-02T10:00:00.000Z",
          },
        }),
        medusaStoreFetch,
        recordNotificationEvent: async (input) => {
          notificationEvents.push(input);

          return {
            ok: true,
            logCount: 1,
          };
        },
        recordAnalyticsEvent: async (input) => {
          analyticsEvents.push(input);

          return {
            ok: true,
            duplicate: false,
            event: {
              id: "event_1",
              eventType: input.eventType,
              occurredAt: "2026-01-01T12:00:00.000Z",
              receivedAt: "2026-01-01T12:00:01.000Z",
              source: input.source,
            },
          };
        },
      },
    );

    const response = await app.request("/store/checkout/cod", {
      body: JSON.stringify({
        cartId: "cart_1",
        shippingOptionId: "so_1",
        deliveryChoice: "delivery",
        customer: {
          name: "Abebe Kebede",
          phone: "+251911111111",
          email: "buyer@example.com",
        },
        address: {
          address1: "Bole Road",
          city: "Addis Ababa",
          landmark: "Near the mall",
        },
        notes: "Call before delivery",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      type: "order",
      order: {
        id: "order_1",
      },
    });
    assert.equal(forwardedRequests.length, 5);
    const updateCartRequest = forwardedRequests[0];
    const shippingMethodRequest = forwardedRequests[1];
    const paymentCollectionRequest = forwardedRequests[2];
    const paymentSessionRequest = forwardedRequests[3];

    assert.ok(updateCartRequest);
    assert.ok(shippingMethodRequest);
    assert.ok(paymentCollectionRequest);
    assert.ok(paymentSessionRequest);
    assert.deepEqual(
      forwardedRequests.map((request) => [request.method, new URL(request.url).pathname]),
      [
        ["POST", "/store/carts/cart_1"],
        ["POST", "/store/carts/cart_1/shipping-methods"],
        ["POST", "/store/payment-collections"],
        ["POST", "/store/payment-collections/paycol_1/payment-sessions"],
        ["POST", "/store/carts/cart_1/complete"],
      ],
    );
    assert.equal(updateCartRequest.headers.get("x-publishable-api-key"), "pk_1");
    assert.deepEqual(JSON.parse(await updateCartRequest.text()), {
      email: "buyer@example.com",
      shipping_address: {
        first_name: "Abebe Kebede",
        phone: "+251911111111",
        address_1: "Bole Road",
        city: "Addis Ababa",
        country_code: "et",
      },
      metadata: {
        checkout_type: "cod",
        payment_method: "cod",
        delivery_choice: "delivery",
        customer_name: "Abebe Kebede",
        customer_phone: "+251911111111",
        landmark: "Near the mall",
        customer_notes: "Call before delivery",
      },
    });
    assert.deepEqual(JSON.parse(await shippingMethodRequest.text()), {
      option_id: "so_1",
      data: {
        delivery_choice: "delivery",
        landmark: "Near the mall",
        customer_notes: "Call before delivery",
      },
    });
    assert.deepEqual(JSON.parse(await paymentCollectionRequest.text()), {
      cart_id: "cart_1",
    });
    assert.deepEqual(JSON.parse(await paymentSessionRequest.text()), {
      provider_id: "pp_system_default",
      data: {
        payment_method: "cod",
      },
    });
    assert.deepEqual(notificationEvents, [
      {
        eventType: "cod_order.created",
        payload: {
          cartId: "cart_1",
          deliveryChoice: "delivery",
          orderId: "order_1",
        },
        tenantId: "tenant_1",
      },
      {
        eventType: "order.created",
        payload: {
          cartId: "cart_1",
          deliveryChoice: "delivery",
          orderId: "order_1",
          paymentMethod: "cod",
        },
        tenantId: "tenant_1",
      },
    ]);
    assert.deepEqual(analyticsEvents, [
      {
        eventType: "order.created",
        idempotencyKey: "cod:cart_1:order.created",
        properties: {
          cartId: "cart_1",
          deliveryChoice: "delivery",
          orderId: "order_1",
          paymentMethod: "cod",
        },
        source: "platform",
        subjectId: "order_1",
        subjectType: "order",
        tenantId: "tenant_1",
      },
    ]);
  });

  it("initializes Chapa checkout with tenant callback metadata", async () => {
    const forwardedRequests: Request[] = [];
    const medusaStoreFetch: typeof fetch = async (request) => {
      const forwardedRequest = request instanceof Request ? request : new Request(request);
      forwardedRequests.push(forwardedRequest.clone());
      const path = new URL(forwardedRequest.url).pathname;

      if (path === "/store/payment-collections") {
        return Response.json({
          payment_collection: {
            id: "paycol_1",
          },
        });
      }

      return Response.json({
        payment_session: {
          id: "payses_1",
          data: {
            checkout_url: "https://checkout.chapa.co/checkout/test",
          },
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        medusaStoreFetch,
      },
    );

    const response = await app.request("/store/checkout/chapa", {
      body: JSON.stringify({
        cartId: "cart_1",
        returnUrl: "http://abebe.lvh.me/checkout/return",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      checkoutUrl: "https://checkout.chapa.co/checkout/test",
      paymentSession: {
        id: "payses_1",
      },
    });
    assert.equal(forwardedRequests.length, 2);

    const paymentCollectionRequest = forwardedRequests[0];
    const paymentSessionRequest = forwardedRequests[1];

    assert.ok(paymentCollectionRequest);
    assert.ok(paymentSessionRequest);
    assert.deepEqual(
      forwardedRequests.map((request) => [request.method, new URL(request.url).pathname]),
      [
        ["POST", "/store/payment-collections"],
        ["POST", "/store/payment-collections/paycol_1/payment-sessions"],
      ],
    );
    assert.deepEqual(JSON.parse(await paymentCollectionRequest.text()), {
      cart_id: "cart_1",
    });
    assert.deepEqual(JSON.parse(await paymentSessionRequest.text()), {
      provider_id: "pp_chapa_chapa",
      data: {
        callback_url: "http://api.lvh.me/platform/payments/chapa/callback?tenant_id=tenant_1",
        return_url: "http://abebe.lvh.me/checkout/return",
      },
    });
  });

  it("does not complete COD checkout when tenant delivery is disabled", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getDeliverySettings: async (input) => ({
          ok: true,
          delivery: {
            tenantId: input.tenantId,
            deliveryEnabled: false,
            pickupEnabled: true,
            phoneConfirmationRequired: true,
            notesEnabled: true,
            landmarkRequired: false,
            defaultDeliveryFee: "50.00",
            currency: "ETB",
            zones: [],
            updatedAt: "2026-06-02T10:00:00.000Z",
          },
        }),
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/checkout/cod", {
      body: JSON.stringify({
        cartId: "cart_1",
        shippingOptionId: "so_1",
        deliveryChoice: "delivery",
        customer: {
          name: "Abebe Kebede",
          phone: "+251911111111",
        },
        address: {
          address1: "Bole Road",
          city: "Addis Ababa",
        },
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "delivery_unavailable",
    });
    assert.equal(fetchCalls, 0);
  });

  it("forwards payment session initialization to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        payment_collection: {
          id: "paycol_1",
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/payment-collections/paycol_1/payment-sessions", {
      body: JSON.stringify({
        provider_id: "pp_system_default",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      payment_collection: {
        id: "paycol_1",
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(
      forwardedRequest.url,
      "http://medusa:9000/store/payment-collections/paycol_1/payment-sessions",
    );
    assert.equal(
      await forwardedRequest.text(),
      JSON.stringify({
        provider_id: "pp_system_default",
      }),
    );
  });

  it("forwards cart completion to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        type: "order",
        order: {
          id: "order_1",
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/carts/cart_1/complete", {
      headers: {
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      type: "order",
      order: {
        id: "order_1",
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/carts/cart_1/complete");
  });

  it("does not forward unsupported store facade routes", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/plugins/internal", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "store_route_not_allowed",
    });
    assert.equal(fetchCalls, 0);
  });

  it("does not forward resolved tenants without a publishable key", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: {
          ...resolvedTenantContext,
          medusaPublishableKeyId: null,
        },
      },
      {
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/products", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "domain_misconfigured",
    });
    assert.equal(fetchCalls, 0);
  });

  it("returns commerce_backend_unavailable when Medusa cannot be reached", async () => {
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        medusaStoreFetch: async () => {
          throw new TypeError("fetch failed");
        },
      },
    );

    const response = await app.request("/store/products", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "commerce_backend_unavailable",
    });
  });
});
