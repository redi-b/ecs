import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStorefrontTemplates, selectStorefrontTemplate } from "./storefront-templates.js";

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
});
