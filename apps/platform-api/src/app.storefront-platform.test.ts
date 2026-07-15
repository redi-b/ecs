import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "./test/platform-app-harness.js";

describe("platform app storefront, delivery, billing, and operator", () => {
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

  it("returns the published storefront config for a draft tenant with a published revision", async () => {
    let configInput: { publishedRevisionId: string; tenantId: string } | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: {
          ...resolvedTenantContext,
          status: "draft",
          publishedRevisionId: "revision_1",
        },
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
    assert.equal((await response.json()).tenant.status, "draft");
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
              published: {
                revisionId: "revision_1",
                publishedAt: "2026-06-02T09:00:00.000Z",
                data: {
                  heroTitle: "Published Market",
                },
                themeTokens: {
                  color: "black",
                },
              },
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
        published: {
          revisionId: "revision_1",
          publishedAt: "2026-06-02T09:00:00.000Z",
          data: {
            heroTitle: "Published Market",
          },
          themeTokens: {
            color: "black",
          },
        },
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
      method: "POST",
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

  it("returns bad request when storefront draft validation fails", async () => {
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
        updateStorefrontDraft: async () => ({
          ok: false,
          error: "invalid_storefront_draft",
        }),
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/storefront/draft", {
      body: JSON.stringify({
        data: {
          checkout: {
            customScript: "<script>alert('no')</script>",
          },
        },
        themeTokens: {},
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "invalid_storefront_draft",
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
                isFree: false,
              },
              availablePaidPlans: [],
              catalog: [
                {
                  id: "plan_1",
                  name: "Starter",
                  price: "999.00",
                  isFree: false,
                  isCurrent: true,
                },
              ],
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
          isFree: false,
        },
        availablePaidPlans: [],
        catalog: [
          {
            id: "plan_1",
            name: "Starter",
            price: "999.00",
            isFree: false,
            isCurrent: true,
          },
        ],
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
});
