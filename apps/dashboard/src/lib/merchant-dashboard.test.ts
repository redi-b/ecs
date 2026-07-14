import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMerchantDashboardSummary } from "./merchant-dashboard.js";

const shellPayload = {
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
    templateKey: "classic@1",
    templateVersion: 1,
  },
};

describe("getMerchantDashboardSummary", () => {
  it("fetches the merchant dashboard summary with selected tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantDashboardSummary({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json(shellPayload);
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/dashboard",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), null);
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  });

  it("fetches lean access shell for layout auth", async () => {
    let forwardedRequest: Request | undefined;
    const { getMerchantDashboardAccessShell } = await import("./merchant-dashboard.js");
    const result = await getMerchantDashboardAccessShell({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "abebe.lvh.me",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);
        return Response.json(shellPayload);
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/merchant/dashboard/access",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
  });

  it("returns a dashboard error for invalid platform responses", async () => {
    const result = await getMerchantDashboardSummary({
      platformApiBaseUrl: "http://platform.local",
      fetcher: async () => Response.json({ tenant: null }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 502,
      message: "invalid_dashboard_response",
    });
  });

  it("returns a dashboard error when the platform request fails", async () => {
    const result = await getMerchantDashboardSummary({
      platformApiBaseUrl: "http://platform.local",
      fetcher: async () => {
        throw new TypeError("fetch failed");
      },
    });

    assert.deepEqual(result, {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    });
  });
});
