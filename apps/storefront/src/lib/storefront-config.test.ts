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
    message: "Please try again later.",
  });
});

/**
 * The function's declared return type is a result object, so a transport failure
 * must arrive as `ok: false`. Throwing here escaped into callers and turned a
 * platform outage into an unhandled 500 on every page that resolves config.
 */
test("an unreachable platform API resolves to a 503 result", async () => {
  const result = await getPublishedStorefrontConfig({
    fetcher: async () => {
      throw new TypeError("fetch failed");
    },
    platformApiBaseUrl: "http://api.lvh.me",
    requestHost: "abebe.lvh.me",
  });

  assert.deepEqual(result, {
    ok: false,
    status: 503,
    message: "Please try again later.",
  });
});

test("an unresolvable platform base URL resolves to a 503 result", async () => {
  // PLATFORM_API_BASE_URL can arrive empty, which makes the config URL unparseable.
  const result = await getPublishedStorefrontConfig({
    platformApiBaseUrl: "",
    requestHost: "abebe.lvh.me",
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 503);
});
