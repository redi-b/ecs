import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("storefront publication reads", () => {
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
});
