import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  PlatformSession,
  PlatformSignInEmailResult,
  PublishedStorefrontConfigResult,
  StorefrontTemplateCatalogItem,
  StorefrontTemplateSelectionResult,
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
    getSession?: (headers: Headers) => Promise<PlatformSession | null>;
    listStorefrontTemplates?: () => Promise<StorefrontTemplateCatalogItem[]>;
    medusaStoreFetch?: typeof fetch;
    selectStorefrontTemplate?: (input: {
      tenantId: string;
      templateKey: string;
      userId: string;
    }) => Promise<StorefrontTemplateSelectionResult>;
    signInWithEmail?: (input: {
      email: string;
      password: string;
      rememberMe: boolean;
      headers: Headers;
    }) => Promise<PlatformSignInEmailResult>;
  },
) {
  return createPlatformApp({
    authHandler: options?.authHandler,
    authorizeDashboardForTenant: options?.authorizeDashboardForTenant,
    getPublishedStorefrontConfig: options?.getPublishedStorefrontConfig,
    getSession: options?.getSession,
    listStorefrontTemplates: options?.listStorefrontTemplates,
    signInWithEmail: options?.signInWithEmail,
    selectStorefrontTemplate: options?.selectStorefrontTemplate,
    serviceName: "platform-api",
    medusaInternalUrl: "http://medusa:9000",
    ...(options?.medusaStoreFetch ? { medusaStoreFetch: options.medusaStoreFetch } : {}),
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

  it("signs in with the platform auth helper and forwards auth cookies", async () => {
    let signInInput:
      | {
          email: string;
          password: string;
          rememberMe: boolean;
          host: string | null;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        signInWithEmail: async (input) => {
          signInInput = {
            email: input.email,
            password: input.password,
            rememberMe: input.rememberMe,
            host: input.headers.get("x-forwarded-host"),
          };

          return {
            headers: new Headers({
              "set-cookie": "better-auth.session_token=session_1; HttpOnly; SameSite=Lax",
            }),
            response: {
              user: {
                id: "user_1",
                email: "owner@abebe.local",
              },
            },
          };
        },
      },
    );

    const response = await app.request("/platform/sessions/email-password", {
      body: JSON.stringify({
        email: " OWNER@ABEBE.LOCAL ",
        password: "password1234",
      }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-host": "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(signInInput, {
      email: "owner@abebe.local",
      password: "password1234",
      rememberMe: true,
      host: "abebe.lvh.me",
    });
    assert.equal(
      response.headers.get("set-cookie"),
      "better-auth.session_token=session_1; HttpOnly; SameSite=Lax",
    );
    assert.deepEqual(await response.json(), {
      user: {
        id: "user_1",
        email: "owner@abebe.local",
      },
    });
  });

  it("maps helper auth failures to invalid credentials", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        signInWithEmail: async () => {
          throw {
            status: 401,
          };
        },
      },
    );

    const response = await app.request("/platform/sessions/email-password", {
      body: JSON.stringify({
        email: "owner@abebe.local",
        password: "wrong",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "invalid_credentials",
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

  it("preserves method and body when forwarding store requests", async () => {
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
      body: JSON.stringify({ region_id: "reg_1" }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 201);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(await forwardedRequest.text(), JSON.stringify({ region_id: "reg_1" }));
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
