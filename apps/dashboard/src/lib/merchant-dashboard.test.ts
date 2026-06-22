import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMerchantDashboardSummary } from "./merchant-dashboard.js";

describe("getMerchantDashboardSummary", () => {
  it("fetches the merchant dashboard summary with the forwarded shop host", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantDashboardSummary({
      actorEmail: "Owner@Abebe.Local",
      dashboardInternalSecret: "test-dashboard-secret",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "abebe.lvh.me",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
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
      },
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequest?.url, "http://platform.local/platform/merchant/dashboard");
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
    assert.equal(forwardedRequest?.headers.get("x-ecs-actor-email"), "owner@abebe.local");
    assert.equal(forwardedRequest?.headers.get("x-ecs-dashboard-secret"), "test-dashboard-secret");
  });

  it("returns a dashboard error for invalid platform responses", async () => {
    const result = await getMerchantDashboardSummary({
      actorEmail: "owner@abebe.local",
      dashboardInternalSecret: "test-dashboard-secret",
      platformApiBaseUrl: "http://platform.local",
      fetcher: async () => Response.json({ tenant: null }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 502,
      message: "invalid_dashboard_response",
    });
  });
});
