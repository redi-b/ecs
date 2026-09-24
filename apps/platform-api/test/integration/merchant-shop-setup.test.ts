import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("merchant shop setup", () => {
  it("updates merchant shop settings for the resolved tenant", async () => {
    let settingsInput:
      | {
          handle: string;
          name: string;
          tenantId: string;
          userId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        updateTenantShopSettings: async (input) => {
          settingsInput = input;

          return {
            ok: true,
            redirectTo: "//new-abebe.lvh.me/dashboard/settings",
            tenant: {
              id: "tenant_1",
              name: input.name,
              handle: input.handle,
              status: "active",
              role: "owner",
              primaryDomain: {
                hostname: "new-abebe.lvh.me",
              },
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/settings", {
      headers: {
        Host: "abebe.lvh.me",
      },
      body: JSON.stringify({
        name: "New Abebe Market",
        handle: "new-abebe",
      }),
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(settingsInput, {
      handle: "new-abebe",
      name: "New Abebe Market",
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      redirectTo: "//new-abebe.lvh.me/dashboard/settings",
      tenant: {
        id: "tenant_1",
        name: "New Abebe Market",
        handle: "new-abebe",
        status: "active",
        role: "owner",
        primaryDomain: {
          hostname: "new-abebe.lvh.me",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("returns tenant readiness for an authorized tenant member", async () => {
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let readinessInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async (input) => {
          authorizationInput = input;

          return {
            ok: true,
            actor: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
              role: "owner",
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantReadiness: async (input) => {
          readinessInput = input;

          return {
            ok: true,
            readiness: {
              ready: false,
              missing: ["commerce_region_missing", "storefront_unpublished"],
              tenant: {
                id: input.tenantId,
                name: "Abebe Market",
                handle: "abebe",
                status: "active",
              },
              checks: {
                tenant: {
                  ready: true,
                  missing: [],
                  isActive: true,
                },
                domain: {
                  ready: true,
                  missing: [],
                  hasPrimaryDomain: true,
                  isActive: true,
                  isVerified: true,
                },
                commerce: {
                  ready: false,
                  missing: ["commerce_region_missing"],
                  hasStore: true,
                  hasSalesChannel: true,
                  hasPublishableKey: true,
                  hasRegion: false,
                  hasShippingOption: true,
                },
                storefront: {
                  ready: false,
                  missing: ["storefront_unpublished"],
                  hasDraft: true,
                  isPublished: false,
                },
                provisioning: {
                  ready: true,
                  missing: [],
                  latestAttempt: null,
                },
              },
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/readiness", {
      headers: {
        Host: "api.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(authorizationInput, {
      permission: { overview: ["read"] },
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(readinessInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      readiness: {
        ready: false,
        missing: ["commerce_region_missing", "storefront_unpublished"],
        tenant: {
          id: "tenant_1",
          name: "Abebe Market",
          handle: "abebe",
          status: "active",
        },
        checks: {
          tenant: {
            ready: true,
            missing: [],
            isActive: true,
          },
          domain: {
            ready: true,
            missing: [],
            hasPrimaryDomain: true,
            isActive: true,
            isVerified: true,
          },
          commerce: {
            ready: false,
            missing: ["commerce_region_missing"],
            hasStore: true,
            hasSalesChannel: true,
            hasPublishableKey: true,
            hasRegion: false,
            hasShippingOption: true,
          },
          storefront: {
            ready: false,
            missing: ["storefront_unpublished"],
            hasDraft: true,
            isPublished: false,
          },
          provisioning: {
            ready: true,
            missing: [],
            latestAttempt: null,
          },
        },
      },
    });
  });

  it("retries a failed tenant provisioning attempt for the current user", async () => {
    let retryInput: { attemptId: string; userId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        retryTenantShopProvisioningAttempt: async (input) => {
          retryInput = input;

          return {
            ok: true,
            tenant: {
              createdAt: "2026-07-06T08:00:00.000Z",
              id: "tenant_2",
              name: "Retry Shop",
              handle: "retry-shop",
              role: "owner",
              status: "draft",
              primaryDomain: {
                hostname: "retry-shop.lvh.me",
              },
              updatedAt: "2026-07-06T08:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/provisioning-attempts/attempt_1/retry", {
      headers: {
        Host: "api.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(retryInput, {
      attemptId: "attempt_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      tenant: {
        createdAt: "2026-07-06T08:00:00.000Z",
        id: "tenant_2",
        name: "Retry Shop",
        handle: "retry-shop",
        role: "owner",
        status: "draft",
        primaryDomain: {
          hostname: "retry-shop.lvh.me",
        },
        updatedAt: "2026-07-06T08:00:00.000Z",
      },
    });
  });

  it("lists provisioning attempts for the current platform user", async () => {
    let listInput: { limit: number; offset: number; userId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        listTenantProvisioningAttempts: async (input) => {
          listInput = input;

          return {
            ok: true,
            attempts: [
              {
                id: "attempt_1",
                completedAt: "2026-06-30T08:00:00.000Z",
                createdAt: "2026-06-30T07:59:59.000Z",
                error: "commerce_backend_unavailable",
                handle: "retry-shop",
                name: "Retry Shop",
                platformTenantId: "00000000-0000-4000-8000-000000000001",
                status: "failed",
                step: "commerce_resources",
                tenantId: null,
              },
            ],
            count: 1,
            limit: input.limit,
            offset: input.offset,
          };
        },
      },
    );

    const response = await app.request("/platform/provisioning-attempts?limit=5&offset=10", {
      headers: {
        Host: "api.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(listInput, {
      limit: 5,
      offset: 10,
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      attempts: [
        {
          id: "attempt_1",
          completedAt: "2026-06-30T08:00:00.000Z",
          createdAt: "2026-06-30T07:59:59.000Z",
          error: "commerce_backend_unavailable",
          handle: "retry-shop",
          name: "Retry Shop",
          platformTenantId: "00000000-0000-4000-8000-000000000001",
          status: "failed",
          step: "commerce_resources",
          tenantId: null,
        },
      ],
      count: 1,
      limit: 5,
      offset: 10,
    });
  });
});
