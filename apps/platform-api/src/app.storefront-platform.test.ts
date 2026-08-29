import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "./test/platform-app-harness.js";

describe("platform app storefront, delivery, billing, and operator", () => {
  it("keeps plan reads, publication, and subscription migration behind exact permissions", async () => {
    const permissions: string[] = [];
    let publishInput: unknown;
    let migrationInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissions.push(permission);
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        getPlanAdministrationCatalog: async () => ({ plans: [] }),
        publishPlanDraft: async (input) => {
          publishInput = input;
          return { ok: true, publication: { action: "published" } } as never;
        },
        migrateSubscriptionPlanVersion: async (input) => {
          migrationInput = input;
          return { ok: true, subscriptionId: "subscription_1" };
        },
      },
    );

    assert.equal((await app.request("/platform/operator/billing/plans")).status, 200);
    assert.equal(
      (
        await app.request("/platform/operator/billing/plans/plan_1/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "Publish reviewed commercial terms" }),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await app.request("/platform/operator/tenants/tenant_1/billing/plan-version", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            planVersionId: "version_2",
            reason: "Move this merchant after support approval",
          }),
        })
      ).status,
      200,
    );
    assert.deepEqual(permissions, [
      "billing.plans.read",
      "billing.plans.update",
      "billing.subscriptions.update",
    ]);
    assert.deepEqual(publishInput, {
      actorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      planId: "plan_1",
      reason: "Publish reviewed commercial terms",
    });
    assert.deepEqual(migrationInput, {
      actorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      planVersionId: "version_2",
      reason: "Move this merchant after support approval",
      tenantId: "tenant_1",
    });
  });

  it("lists active storefront templates", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        listStorefrontTemplates: async () => [
          {
            id: "template_1",
            slug: "luvia",
            name: "Luvia",
            description: "A clean storefront.",
            previewAssetId: null,
            tags: ["default"],
            minimumPlanId: null,
            version: {
              id: "template_version_1",
              version: 1,
              templateKey: "luvia@1",
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
          slug: "luvia",
          name: "Luvia",
          description: "A clean storefront.",
          previewAssetId: null,
          tags: ["default"],
          minimumPlanId: null,
          version: {
            id: "template_version_1",
            version: 1,
            templateKey: "luvia@1",
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
              templateKey: "luvia@1",
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
        primaryDomain: {
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
        templateKey: "luvia@1",
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
        seo: { title: null, description: null, socialImageUrl: null },
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
              templateKey: "luvia@1",
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
            templateKey: "luvia@1",
            source: "clean",
            hasUnpublishedChanges: true,
          },
        }),
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/storefront/template/select", {
      body: JSON.stringify({ templateKey: "luvia@1" }),
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
    let selectionInput:
      | { tenantId: string; templateKey: string; mode?: "clean" | "resume"; userId: string }
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
        selectStorefrontTemplate: async (input) => {
          selectionInput = input;

          return {
            ok: true,
            draft: {
              tenantId: input.tenantId,
              templateId: "template_1",
              templateVersion: 1,
              templateKey: input.templateKey,
              source: "clean",
              hasUnpublishedChanges: true,
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/storefront/template/select", {
      body: JSON.stringify({ templateKey: " luvia@1 " }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(selectionInput, {
      tenantId: "tenant_1",
      templateKey: "luvia@1",
      mode: "resume",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      draft: {
        tenantId: "tenant_1",
        templateId: "template_1",
        templateVersion: 1,
        templateKey: "luvia@1",
        source: "clean",
        hasUnpublishedChanges: true,
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
              templateKey: "luvia@1",
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
        templateKey: "luvia@1",
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
              templateKey: "luvia@1",
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
        templateKey: "luvia@1",
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
              templateKey: "luvia@1",
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
        templateKey: "luvia@1",
        publishedAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("unpublishes a storefront for an authorized tenant member", async () => {
    let unpublishInput: { tenantId: string; userId: string } | undefined;
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
        unpublishStorefront: async (input) => {
          unpublishInput = input;

          return {
            ok: true,
            storefront: {
              tenantId: input.tenantId,
              isPublished: false as const,
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/storefront/unpublish", {
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(unpublishInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      storefront: {
        tenantId: "tenant_1",
        isPublished: false,
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

    const bothOff = await app.request("/platform/tenants/tenant_1/delivery", {
      body: JSON.stringify({
        ...body,
        deliveryEnabled: false,
        pickupEnabled: false,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "PUT",
    });
    assert.equal(bothOff.status, 400);
    assert.deepEqual(await bothOff.json(), { error: "fulfillment_method_required" });
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
      body: JSON.stringify({ templateKey: "luvia@1" }),
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

  it("verifies custom-domain ownership for an authorized tenant member", async () => {
    let verifyInput: unknown;
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
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe Owner" },
        }),
        verifyTenantDomainOwnership: async (input) => {
          verifyInput = input;
          return {
            ok: true,
            domain: {
              id: input.domainId,
              hostname: "shop.example.com",
              type: "custom_domain",
              status: "pending_certificate",
              isPrimary: false,
              verificationStatus: "verified",
              sslStatus: "pending",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/domains/domain_2/verify", {
      method: "POST",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(verifyInput, {
      domainId: "domain_2",
      tenantId: "tenant_1",
      userId: "user_1",
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
                planVersionId: "plan_version_1",
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
          planVersionId: "plan_version_1",
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
          session: { createdAt: new Date() },
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
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
              notes: input.reason,
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
          reason: " Approved after license check. ",
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
      platformPrincipalId: "principal_1",
      paymentOnboardingId: "payment_onboarding_1",
      status: "approved",
      reason: "Approved after license check.",
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

  it("returns operator identity and exact active permissions from one session endpoint", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getPlatformPrincipalAccess: async (userId) => ({
          principal: { id: "principal_1", userId },
          permissions: ["platform.overview.read", "tenants.read"],
        }),
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "ECS Operator" },
        }),
      },
    );

    const response = await app.request("/platform/operator/session");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      operator: { id: "operator_1", email: "operator@ecs.local", name: "ECS Operator" },
      principalId: "principal_1",
      permissions: ["platform.overview.read", "tenants.read"],
    });
  });

  it("returns the operations overview through exact read authority", async () => {
    let permissionSeen: string | undefined;
    const overview = {
      summary: { merchants: 12, activeMerchants: 9, attentionItems: 2, activeSupportAccess: 1 },
      attention: [],
      recentActivity: [],
      generatedAt: "2026-08-26T12:00:00.000Z",
    };
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        getSuperadminOverview: async () => overview,
      },
    );

    const response = await app.request("/platform/operator/overview");

    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "platform.overview.read");
    assert.deepEqual(await response.json(), overview);
  });

  it("keeps work, audit, and operator directory reads behind separate permissions", async () => {
    const permissions: string[] = [];
    let auditInput: unknown;
    let workInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissions.push(permission);
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        listSuperadminWork: async (input) => {
          workInput = input;
          return {
            kind: input.kind ?? "shop_setup",
            items: [],
            count: 0,
            limit: input.limit,
            offset: input.offset,
          };
        },
        listSuperadminAudit: async (input) => {
          auditInput = input;
          return { events: [], count: 0, limit: input.limit, offset: input.offset };
        },
        listPlatformOperators: async () => ({ operators: [] }),
        getPlatformHealth: async () => ({
          status: "clear",
          dependencies: [],
          backgroundWork: {
            queued: 0,
            active: 0,
            failedLast24Hours: 0,
            oldestQueuedAt: null,
            types: [],
          },
          notifications: { pending: 0, retrying: 0, failedLast24Hours: 0, channels: [] },
          media: { pending: 0, processing: 0, ready: 0, failed: 0 },
          merchants: { active: 0, draft: 0, suspended: 0, cancelled: 0 },
          generatedAt: "2026-08-27T00:00:00.000Z",
        }),
      },
    );

    assert.equal(
      (await app.request("/platform/operator/work?kind=background_job&limit=15&offset=30")).status,
      200,
    );
    assert.equal(
      (
        await app.request(
          "/platform/operator/audit?category=support&limit=25&offset=50&actor=Liya&merchant=bole&action=support&resource=grant&outcome=failed&from=2026-08-01&to=2026-08-27",
        )
      ).status,
      200,
    );
    assert.equal((await app.request("/platform/operator/operators")).status, 200);
    assert.equal((await app.request("/platform/operator/health")).status, 200);
    assert.deepEqual(permissions, [
      "platform.work.read",
      "platform.audit.read",
      "platform.operators.read",
      "platform.health.read",
    ]);
    assert.deepEqual(workInput, { kind: "background_job", limit: 15, offset: 30 });
    assert.deepEqual(auditInput, {
      action: "support",
      actor: "Liya",
      category: "support",
      from: new Date("2026-07-31T21:00:00.000Z"),
      limit: 25,
      merchant: "bole",
      offset: 50,
      outcome: "failed",
      resource: "grant",
      to: new Date("2026-08-27T21:00:00.000Z"),
    });
  });

  it("projects merchant commerce review sections through their separate read permissions", async () => {
    const permissions: string[] = [];
    let reviewInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissions.push(permission);
          return permission === "billing.invoices.read"
            ? { ok: true, permission, principal: { id: "principal_1", userId } }
            : { ok: false };
        },
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        getSuperadminCommerceReview: async (input) => {
          reviewInput = input;
          return { billing: null, paymentOnboarding: null };
        },
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/commerce-review");

    assert.equal(response.status, 200);
    assert.deepEqual(permissions, ["billing.invoices.read", "payments.onboarding.read"]);
    assert.deepEqual(reviewInput, {
      includeBilling: true,
      includePayments: false,
      tenantId: "tenant_1",
    });
  });

  it("recovers failed setup only through recent retry authority with a recorded reason", async () => {
    let permissionSeen: string | undefined;
    let recoveryInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        recoverSuperadminWork: async (input) => {
          recoveryInput = input;
          return {
            ok: true,
            tenant: {
              id: "tenant_1",
              name: "Recovered Shop",
              handle: "recovered-shop",
              status: "draft",
              createdAt: "2026-08-27T00:00:00.000Z",
              updatedAt: "2026-08-27T00:00:00.000Z",
            },
          } as never;
        },
      },
    );

    const response = await app.request("/platform/operator/work/attempt_1/recover", {
      body: JSON.stringify({ reason: "Provider credentials were corrected" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "platform.work.retry");
    assert.deepEqual(recoveryInput, {
      attemptId: "attempt_1",
      operatorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      reason: "Provider credentials were corrected",
    });
  });

  it("returns entitlement diagnostics through read-only platform authority", async () => {
    let tenantId: string | undefined;
    let permissionSeen: string | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return {
            ok: true,
            permission,
            principal: { id: "principal_1", userId },
          };
        },
        getEntitlementSummary: async (input) => {
          tenantId = input.tenantId;
          return {
            entitlement: {
              allowed: true,
              key: "customDomains",
              source: "override",
              subscriptionStatus: "active",
            },
            overrides: [],
          };
        },
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
      },
    );
    const response = await app.request("/platform/operator/tenants/tenant_1/entitlements");
    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "billing.entitlements.read");
    assert.equal(tenantId, "tenant_1");
    assert.equal((await response.json()).entitlement.source, "override");
  });

  it("lists support access through read-only platform authority", async () => {
    let permissionSeen: string | undefined;
    let tenantId: string | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          session: { createdAt: new Date(0) },
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        listSupportAccessGrants: async (input) => {
          tenantId = input.tenantId;
          return { grants: [] };
        },
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/support-access");

    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "tenants.support.access.read");
    assert.equal(tenantId, "tenant_1");
    assert.deepEqual(await response.json(), { grants: [] });
  });

  it("returns only the safe operational summary with tenants.operations.read", async () => {
    let permissionSeen: string | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return {
            ok: true,
            permission,
            principal: { id: "principal_1", userId },
          };
        },
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        getSuperadminOperationalSummary: async () => ({
          ok: true,
          summary: {
            readiness: {
              ready: true,
              missing: [],
              tenantReady: true,
              domainReady: true,
              commerceReady: true,
              storefrontReady: true,
              provisioningReady: true,
            },
            storefront: { hasDraft: true, isPublished: true },
            domains: { total: 1, custom: 0, pending: 0, primaryHostname: "abebe.lvh.me" },
            billing: {
              available: true,
              planName: "Starter",
              subscriptionStatus: "active",
              pendingInvoiceCount: 0,
            },
            payments: { total: 1, pendingReview: 0, approved: 1 },
          },
        }),
      },
    );
    const response = await app.request("/platform/operator/tenants/tenant_1/operations");
    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "tenants.operations.read");
    assert.equal((await response.json()).billing.planName, "Starter");
  });

  it("returns projected diagnostics with tenants.diagnostics.read", async () => {
    let permissionSeen: string | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        getSuperadminDiagnostics: async () => ({
          jobs: { recentFailures: [] },
          notifications: { recentFailures: [] },
          media: { total: 3, pending: 1, ready: 2, failed: 0, recentFailures: [] },
        }),
      },
    );
    const response = await app.request("/platform/operator/tenants/tenant_1/diagnostics");
    assert.equal(response.status, 200);
    assert.equal(permissionSeen, "tenants.diagnostics.read");
    assert.equal((await response.json()).media.ready, 2);
  });

  it("lets a recently authenticated platform principal create an entitlement override", async () => {
    let overrideInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        createEntitlementOverride: async (input) => {
          overrideInput = input;
          return { ok: true, override: { id: "override_1" } };
        },
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
      },
    );

    const response = await app.request(
      "/platform/operator/tenants/tenant_1/entitlements/customDomains/overrides",
      {
        body: JSON.stringify({
          expiresAt: "2099-08-25T12:00:00.000Z",
          reason: " Temporary launch support ",
          value: true,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 201);
    assert.deepEqual(overrideInput, {
      expiresAt: new Date("2099-08-25T12:00:00.000Z"),
      key: "customDomains",
      operatorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      reason: "Temporary launch support",
      tenantId: "tenant_1",
      value: true,
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
          session: { createdAt: new Date() },
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
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
          reason: "Bank receipt matched the invoice total.",
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
      platformPrincipalId: "principal_1",
      invoiceId: "invoice_1",
      status: "paid",
      provider: "manual",
      providerReference: "receipt_1",
      reason: "Bank receipt matched the invoice total.",
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
          session: { createdAt: new Date() },
          user: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
          },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
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
      platformPrincipalId: "principal_1",
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
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
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
                  operator: {
                    id: "operator_1",
                    name: "Operator",
                    email: "operator@ecs.local",
                  },
                  body: "Called merchant about billing.",
                  visibility: "internal",
                  createdAt: "2026-06-02T10:00:00.000Z",
                },
              ],
              auditLogs: [
                {
                  id: "audit_1",
                  actorUserId: "operator_1",
                  actor: {
                    id: "operator_1",
                    name: "Operator",
                    email: "operator@ecs.local",
                  },
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
            operator: {
              id: "operator_1",
              name: "Operator",
              email: "operator@ecs.local",
            },
            body: "Called merchant about billing.",
            visibility: "internal",
            createdAt: "2026-06-02T10:00:00.000Z",
          },
        ],
        auditLogs: [
          {
            id: "audit_1",
            actorUserId: "operator_1",
            actor: {
              id: "operator_1",
              name: "Operator",
              email: "operator@ecs.local",
            },
            action: "tenant.status_changed",
            targetType: "tenant",
            targetId: "tenant_1",
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
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        createOperatorSupportNote: async (input) => {
          noteInput = input;

          return {
            ok: true,
            note: {
              id: "note_1",
              operatorUserId: input.operatorUserId,
              operator: null,
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
      platformPrincipalId: "principal_1",
      body: "Called merchant about billing.",
      visibility: "internal",
    });
    assert.deepEqual(await response.json(), {
      note: {
        id: "note_1",
        operatorUserId: "operator_1",
        operator: null,
        body: "Called merchant about billing.",
        visibility: "internal",
        createdAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("rejects oversized internal support notes before persistence", async () => {
    let created = false;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        createOperatorSupportNote: async () => {
          created = true;
          throw new Error("should_not_run");
        },
      },
    );

    const response = await app.request("/platform/operator/tenants/tenant_1/support/notes", {
      body: JSON.stringify({ body: "x".repeat(4_001) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    assert.equal(response.status, 400);
    assert.equal(created, false);
  });

  it("grants temporary support access only through recent exact platform authority", async () => {
    let permissionSeen: string | undefined;
    let grantInput: unknown;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizePlatformPermission: async ({ permission, userId }) => {
          permissionSeen = permission;
          return { ok: true, permission, principal: { id: "principal_1", userId } };
        },
        createSupportAccessGrant: async (input) => {
          grantInput = input;
          return {
            ok: true,
            grant: {
              id: "grant_1",
              operatorUserId: input.operatorUserId,
              reason: input.reason,
              expiresAt: input.expiresAt.toISOString(),
              revokedAt: null,
              revokeReason: null,
              createdAt: new Date().toISOString(),
            },
          };
        },
        getSession: async () => ({
          session: { createdAt: new Date() },
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
      },
    );
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const response = await app.request("/platform/operator/tenants/tenant_1/support-access", {
      body: JSON.stringify({ expiresAt, reason: "Investigating support case ECS-100" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 201);
    assert.equal(permissionSeen, "tenants.support.access.manage");
    assert.deepEqual(grantInput, {
      expiresAt: new Date(expiresAt),
      operatorUserId: "operator_1",
      platformPrincipalId: "principal_1",
      reason: "Investigating support case ECS-100",
      tenantId: "tenant_1",
    });
  });

  it("issues a tenant-scoped preview capability and serves the matching draft", async () => {
    const secret = "test-preview-secret-that-is-at-least-32-bytes";
    const getStorefrontDraft = async (input: { tenantId: string }) => ({
      ok: true as const,
      draft: {
        tenantId: input.tenantId,
        templateId: "template_luvia",
        templateVersion: 1,
        templateKey: "luvia@1",
        data: { home: { hero: { title: "Draft title" } } },
        themeTokens: { colors: { primary: "#3ee272" } },
        updatedAt: "2026-08-16T00:00:00.000Z",
      },
    });
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        storefrontPreviewSecret: secret,
        getStorefrontDraft,
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Owner" },
        }),
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Owner", role: "owner" },
        }),
      },
    );
    const sessionResponse = await app.request(
      "/platform/tenants/tenant_1/storefront/preview-session",
      { method: "POST" },
    );
    assert.equal(sessionResponse.status, 200);
    const session = (await sessionResponse.json()) as { token: string; expiresAt: string };
    assert.ok(session.token);
    assert.ok(session.expiresAt);

    const configResponse = await app.request(
      `/platform/storefront/preview-config?token=${encodeURIComponent(session.token)}`,
      { headers: { Host: "abebe.lvh.me" } },
    );
    assert.equal(configResponse.status, 200);
    assert.equal(configResponse.headers.get("cache-control"), "private, no-store");
    const config = (await configResponse.json()) as {
      storefront: { templateKey: string; data: unknown };
    };
    assert.equal(config.storefront.templateKey, "luvia@1");
    assert.deepEqual(config.storefront.data, { home: { hero: { title: "Draft title" } } });
  });

  it("rejects a preview capability on a different tenant host", async () => {
    const secret = "test-preview-secret-that-is-at-least-32-bytes";
    const issuingApp = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        storefrontPreviewSecret: secret,
        getStorefrontDraft: async () => ({
          ok: true as const,
          draft: {
            tenantId: "tenant_1",
            templateId: "template_luvia",
            templateVersion: 1,
            templateKey: "luvia@1",
            data: {},
            themeTokens: {},
            updatedAt: "2026-08-16T00:00:00.000Z",
          },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Owner" },
        }),
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Owner", role: "owner" },
        }),
      },
    );
    const sessionResponse = await issuingApp.request(
      "/platform/tenants/tenant_1/storefront/preview-session",
      { method: "POST" },
    );
    const session = (await sessionResponse.json()) as { token: string };
    const wrongTenant = { ...resolvedTenantContext, tenantId: "tenant_2" };
    const consumingApp = appWithResolution(
      { ok: true, context: wrongTenant },
      {
        storefrontPreviewSecret: secret,
        getStorefrontDraft: async () => ({
          ok: false as const,
          error: "storefront_draft_not_found",
        }),
      },
    );
    const response = await consumingApp.request(
      `/platform/storefront/preview-config?token=${encodeURIComponent(session.token)}`,
      { headers: { Host: "other.lvh.me" } },
    );
    assert.equal(response.status, 403);
  });

  it("requires authentication to read storefront SEO", async () => {
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        getStorefrontSeoSettings: async () => ({
          ok: true,
          seo: { title: null, description: null, socialImageUrl: null },
        }),
      },
    );
    const response = await app.request("/platform/tenants/tenant_1/storefront/seo");
    assert.equal(response.status, 401);
  });

  it("validates and updates tenant storefront SEO with a trusted media URL", async () => {
    const previousBase = process.env.MEDIA_S3_PUBLIC_BASE_URL;
    process.env.MEDIA_S3_PUBLIC_BASE_URL = "https://media.example.com/tenants";
    let received: unknown;
    try {
      const app = appWithResolution(
        { ok: true, context: resolvedTenantContext },
        {
          getSession: async () => ({
            user: { id: "user_1", email: "owner@example.com", name: "Owner" },
          }),
          authorizeDashboardForTenant: async () => ({
            ok: true,
            actor: { id: "user_1", email: "owner@example.com", name: "Owner", role: "owner" },
          }),
          updateStorefrontSeoSettings: async (input) => {
            received = input;
            return { ok: true, seo: input.seo };
          },
        },
      );
      const seo = {
        title: "Abebe Market",
        description: "Everyday goods in Addis Ababa.",
        socialImageUrl: "https://media.example.com/tenants/tenant_1/share.jpg",
      };
      const response = await app.request("/platform/tenants/tenant_1/storefront/seo", {
        body: JSON.stringify({ seo }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      assert.equal(response.status, 200);
      assert.deepEqual(received, { tenantId: "tenant_1", userId: "user_1", seo });
    } finally {
      if (previousBase === undefined) delete process.env.MEDIA_S3_PUBLIC_BASE_URL;
      else process.env.MEDIA_S3_PUBLIC_BASE_URL = previousBase;
    }
  });

  it("does not treat an operator tenant membership as platform authority", async () => {
    let mutated = false;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: { id: "operator_1", email: "operator@ecs.local", name: "Operator" },
        }),
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "operator_1",
            email: "operator@ecs.local",
            name: "Operator",
            role: "operator",
          },
        }),
        updateTenantStatus: async () => {
          mutated = true;
          return { ok: false, error: "tenant_not_found", status: 404 };
        },
      },
    );
    const response = await app.request("/platform/operator/tenants/tenant_1/status", {
      body: JSON.stringify({ status: "suspended" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 403);
    assert.equal(mutated, false);
  });

  it("requires recent authentication for high-risk platform mutations", async () => {
    let mutated = false;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          session: { createdAt: new Date(Date.now() - 11 * 60 * 1_000) },
          user: { id: "user_1", email: "ops@ecs.local", name: "Ops" },
        }),
        authorizePlatformPermission: async ({ permission, userId }) => ({
          ok: true,
          permission,
          principal: { id: "principal_1", userId },
        }),
        updateTenantStatus: async () => {
          mutated = true;
          return { ok: false, error: "tenant_not_found", status: 404 };
        },
      },
    );
    const response = await app.request("/platform/operator/tenants/tenant_1/status", {
      body: JSON.stringify({ status: "suspended" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "reauthentication_required" });
    assert.equal(mutated, false);
  });

  it("lists only the allowlisted tenant projection with tenants.read", async () => {
    let listInput: unknown;
    const tenant = {
      id: "tenant_1",
      name: "Abebe Market",
      handle: "abebe",
      ownerEmail: "owner@abebe.example",
      status: "active" as const,
      primaryDomainHostname: "abebe.lvh.me",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({ user: { id: "user_1", email: "ops@ecs.local", name: "Ops" } }),
        authorizePlatformPermission: async ({ permission, userId }) =>
          permission === "tenants.read"
            ? { ok: true, permission, principal: { id: "principal_1", userId } }
            : { ok: false },
        listSuperadminTenants: async (input) => {
          listInput = input;
          return { tenants: [tenant], count: 1, limit: input.limit, offset: input.offset };
        },
      },
    );
    const response = await app.request("/platform/operator/tenants?q=abebe&limit=10&offset=20");
    assert.equal(response.status, 200);
    assert.deepEqual(listInput, { query: "abebe", limit: 10, offset: 20 });
    assert.deepEqual(await response.json(), { tenants: [tenant], count: 1, limit: 10, offset: 20 });
  });
});
