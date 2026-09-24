import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution } from "../support/platform-app-harness.js";

describe("tenant creation", () => {
  it("requires a platform session before creating a tenant shop", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        createTenantShop: async () => {
          throw new Error("should not create tenant shop without a session");
        },
      },
    );

    const response = await app.request("/platform/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "New Shop",
        handle: "new-shop",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "auth_required",
    });
  });

  it("validates tenant shop creation input", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: { id: "user_1", email: "owner@example.com", name: "Owner" },
        }),
        createTenantShop: async () => {
          throw new Error("should not create tenant shop with invalid input");
        },
      },
    );

    const response = await app.request("/platform/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "New Shop",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "missing_handle",
    });
  });

  it("creates a tenant shop for the current platform user", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: { id: "user_1", email: "owner@example.com", name: "Owner" },
        }),
        createTenantShop: async (input) => {
          assert.deepEqual(input, {
            name: "New Shop",
            handle: "new-shop",
            ownerUserId: "user_1",
            templateKey: "luvia@1",
          });

          return {
            ok: true,
            tenant: {
              createdAt: "2026-07-06T08:00:00.000Z",
              id: "tenant_2",
              name: "New Shop",
              handle: "new-shop",
              role: "owner",
              status: "draft",
              primaryDomain: {
                hostname: "new-shop.lvh.me",
              },
              updatedAt: "2026-07-06T08:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: "New Shop",
        handle: "new-shop",
        templateKey: "luvia@1",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      redirectTo: "http://new-shop.lvh.me/dashboard",
      tenant: {
        createdAt: "2026-07-06T08:00:00.000Z",
        id: "tenant_2",
        name: "New Shop",
        handle: "new-shop",
        role: "owner",
        status: "draft",
        primaryDomain: {
          hostname: "new-shop.lvh.me",
        },
        updatedAt: "2026-07-06T08:00:00.000Z",
      },
    });
  });

  it("does not create a second owned shop", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: { id: "user_1", email: "owner@example.com", name: "Owner" },
        }),
        getTenantMembershipSummary: async () => ({ accessibleCount: 2, ownedCount: 1 }),
        createTenantShop: async () => {
          throw new Error("should not create another owned shop");
        },
      },
    );

    const response = await app.request("/platform/tenants", {
      method: "POST",
      body: JSON.stringify({ handle: "second-shop", name: "Second Shop" }),
      headers: { "content-type": "application/json" },
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "shop_owner_limit_reached" });
  });
});
