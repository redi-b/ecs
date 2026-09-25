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
      requestHost: "app.lvh.me",
    });

    assert.equal(redirect, null);
  });

  for (const shopStatus of ["active", "draft"] as const) {
    it(`routes central dashboard users to their existing ${shopStatus} shop`, async () => {
      globalThis.fetch = async () =>
        Response.json({
          user: {
            id: "user_1",
            email: "owner@example.com",
            name: "Mahi Bekele",
            phone: "+251912345678",
          },
          tenants: [
            {
              createdAt: "2026-09-01T00:00:00.000Z",
              handle: "addis-pantry",
              id: "tenant_1",
              name: "Addis Pantry",
              primaryDomain: { hostname: "addis-pantry.lvh.me" },
              role: "owner",
              status: shopStatus,
              updatedAt: "2026-09-01T00:00:00.000Z",
            },
          ],
          primaryTenant: {
            id: "tenant_1",
            handle: "addis-pantry",
            primaryDomain: "addis-pantry.lvh.me",
            dashboardUrl: "http://addis-pantry.lvh.me/dashboard",
          },
          latestProvisioningAttempt: null,
        });

      const redirect = await getAuthenticatedDashboardRedirect({
        cookieHeader: "better-auth.session_token=session_1",
        platformApiBaseUrl: "http://platform.local",
        requestHost: "app.lvh.me",
      });

      assert.equal(redirect, "http://addis-pantry.lvh.me/dashboard");
    });
  }

  it("routes central dashboard users with an incomplete account to phone completion", async () => {
    globalThis.fetch = async () =>
      Response.json({
        user: {
          id: "user_1",
          email: "owner@example.com",
          name: "Mahi Bekele",
          phone: null,
        },
        tenants: [],
        primaryTenant: null,
        latestProvisioningAttempt: null,
      });

    const redirect = await getAuthenticatedDashboardRedirect({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "app.lvh.me",
    });

    assert.equal(redirect, "/complete-account?next=%2Fdashboard");
  });

  it("routes an existing Operations session away from merchant onboarding", async () => {
    globalThis.fetch = async () =>
      Response.json({
        operator: { id: "operator_1", email: "operations@ecs.local", name: "ECS Operations" },
        principalId: "principal_1",
        permissions: ["platform.overview.read"],
      });

    const redirect = await getAuthenticatedDashboardRedirect({
      cookieHeader: "better-auth.session_token=operator_session",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "app.lvh.me",
    });

    assert.equal(redirect, "http://ops.lvh.me");
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
          templateKey: "luvia@1",
          templateVersion: 1,
        },
      });

    const redirect = await getAuthenticatedDashboardRedirect({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "addis-pantry.lvh.me",
    });

    assert.equal(redirect, "/dashboard");
  });
});
