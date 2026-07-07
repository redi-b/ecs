import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getStorefrontDraft,
  getStorefrontTemplates,
  publishStorefrontDraft,
  selectStorefrontTemplate,
  updateStorefrontDraft,
} from "./storefront-templates.js";

describe("storefront template helpers", () => {
  it("fetches the storefront template catalog", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getStorefrontTemplates({
      platformApiBaseUrl: "http://platform.local",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
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
      },
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequest?.url, "http://platform.local/platform/storefront/templates");
  });

  it("selects a storefront template with the forwarded session cookie", async () => {
    let forwardedRequest: Request | undefined;
    const result = await selectStorefrontTemplate({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      templateKey: "classic@1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          draft: {
            tenantId: "tenant_1",
            templateId: "template_1",
            templateVersion: 1,
            templateKey: "classic@1",
          },
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/storefront/template/select",
    );
    assert.equal(forwardedRequest?.method, "POST");
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
    assert.deepEqual(await forwardedRequest?.json(), { templateKey: "classic@1" });
  });

  it("returns a catalog error for invalid platform responses", async () => {
    const result = await getStorefrontTemplates({
      platformApiBaseUrl: "http://platform.local",
      fetcher: async () => Response.json({ templates: null }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 502,
      message: "invalid_template_catalog_response",
    });
  });

  it("fetches a tenant storefront draft with the forwarded session cookie", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getStorefrontDraft({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          draft: {
            tenantId: "tenant_1",
            templateId: "template_1",
            templateVersion: 1,
            templateKey: "classic@1",
            data: { home: {} },
            themeTokens: { colors: {} },
            updatedAt: "2026-06-02T10:00:00.000Z",
            published: {
              revisionId: "revision_1",
              publishedAt: "2026-06-02T09:00:00.000Z",
              data: { home: { hero: { title: "Published" } } },
              themeTokens: { colors: { primary: "#111111" } },
            },
          },
        });
      },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok ? result.draft.published : null, {
      revisionId: "revision_1",
      publishedAt: "2026-06-02T09:00:00.000Z",
      data: { home: { hero: { title: "Published" } } },
      themeTokens: { colors: { primary: "#111111" } },
    });
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/storefront/draft",
    );
    assert.equal(forwardedRequest?.method, "GET");
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  });

  it("updates a tenant storefront draft with a POST body", async () => {
    let forwardedRequest: Request | undefined;
    const result = await updateStorefrontDraft({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      data: { home: { hero: { title: "Updated" } } },
      themeTokens: { colors: { primary: "#111111" } },
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          draft: {
            tenantId: "tenant_1",
            templateId: "template_1",
            templateVersion: 1,
            templateKey: "classic@1",
            data: { home: { hero: { title: "Updated" } } },
            themeTokens: { colors: { primary: "#111111" } },
            updatedAt: "2026-06-02T10:00:00.000Z",
          },
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequest?.method, "POST");
    assert.equal(forwardedRequest?.headers.get("content-type"), "application/json");
    assert.deepEqual(await forwardedRequest?.json(), {
      data: { home: { hero: { title: "Updated" } } },
      themeTokens: { colors: { primary: "#111111" } },
    });
  });

  it("publishes a tenant storefront draft", async () => {
    let forwardedRequest: Request | undefined;
    const result = await publishStorefrontDraft({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          storefront: {
            tenantId: "tenant_1",
            publishedRevisionId: "revision_1",
            templateId: "template_1",
            templateVersion: 1,
            templateKey: "classic@1",
            publishedAt: "2026-06-02T10:00:00.000Z",
          },
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/storefront/publish",
    );
    assert.equal(forwardedRequest?.method, "POST");
  });

  it("returns a draft error for invalid platform draft responses", async () => {
    const result = await getStorefrontDraft({
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      fetcher: async () => Response.json({ draft: null }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 502,
      message: "invalid_storefront_draft_response",
    });
  });
});
