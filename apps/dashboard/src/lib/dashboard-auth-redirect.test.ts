import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getAuthenticatedDashboardRedirect } from "./dashboard-auth-redirect.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getAuthenticatedDashboardRedirect", () => {
  it("returns null without a session cookie", async () => {
    const redirect = await getAuthenticatedDashboardRedirect({
      platformApiBaseUrl: "http://platform.local",
      requestHost: "dashboard.lvh.me",
    });

    assert.equal(redirect, null);
  });

  it("routes authenticated central dashboard users to their primary shop", async () => {
    globalThis.fetch = async () =>
      Response.json({
        user: {
          id: "user_1",
          email: "owner@example.com",
          name: "Mahi Bekele",
        },
        tenants: [],
        primaryTenant: {
          id: "tenant_1",
          handle: "addis-pantry",
          primaryDomain: "addis-pantry.lvh.me",
          dashboardUrl: "http://addis-pantry.lvh.me/admin",
        },
        latestProvisioningAttempt: null,
      });

    const redirect = await getAuthenticatedDashboardRedirect({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "dashboard.lvh.me",
    });

    assert.equal(redirect, "http://addis-pantry.lvh.me/admin");
  });

  it("routes authenticated shop-host users to the shop dashboard", async () => {
    globalThis.fetch = async () =>
      Response.json({
        tenant: {
          id: "tenant_1",
          name: "Addis Pantry",
          handle: "addis-pantry",
          status: "active",
        },
        domain: {
          id: "domain_1",
          hostname: "addis-pantry.lvh.me",
        },
        actor: {
          id: "user_1",
          email: "owner@example.com",
          name: "Mahi Bekele",
          role: "owner",
        },
        commerce: {
          hasPublishableKey: true,
          hasSalesChannel: true,
          hasStore: true,
        },
        storefront: {
          isPublished: false,
          publishedRevisionId: null,
          templateId: "template_1",
          templateKey: "classic@1",
          templateVersion: 1,
        },
      });

    const redirect = await getAuthenticatedDashboardRedirect({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "addis-pantry.lvh.me",
    });

    assert.equal(redirect, "/admin");
  });
});
