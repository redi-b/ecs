import assert from "node:assert/strict";
import test from "node:test";

import { getPublishedStorefrontConfig } from "./storefront-config.js";

test("getPublishedStorefrontConfig calls platform config with host context", async () => {
  const requests: Request[] = [];
  const result = await getPublishedStorefrontConfig({
    fetcher: async (request) => {
      requests.push(request);

      return Response.json({
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
    },
    platformApiBaseUrl: "http://api.lvh.me",
    requestHost: "abebe.lvh.me",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "http://api.lvh.me/platform/storefront/config");
  assert.equal(requests[0]?.headers.get("x-forwarded-host"), "abebe.lvh.me");
  assert.equal(result.ok, true);
});

test("getPublishedStorefrontConfig returns an error for invalid config responses", async () => {
  const result = await getPublishedStorefrontConfig({
    fetcher: async () => Response.json({ tenant: null }),
    platformApiBaseUrl: "http://api.lvh.me",
    requestHost: "abebe.lvh.me",
  });

  assert.deepEqual(result, {
    ok: false,
    status: 502,
    message: "This shop could not be loaded. Please try again later.",
  });
});
