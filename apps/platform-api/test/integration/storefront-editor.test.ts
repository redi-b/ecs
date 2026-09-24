import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, } from "../support/platform-app-harness.js";

describe("storefront editor", () => {
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
});
