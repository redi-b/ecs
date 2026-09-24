import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("storefront preview and SEO", () => {
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
});
