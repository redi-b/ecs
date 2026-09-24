import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("merchant taxonomy", () => {
  it("creates merchant product categories scoped to the resolved tenant", async () => {
    let resolvedHost: string | undefined;
    let sessionCookie: string | null = null;
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let categoryInput:
      | {
          handle?: string | null | undefined;
          name: string;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
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
        getSession: async (headers) => {
          sessionCookie = headers.get("cookie");

          return {
            user: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
            },
          };
        },
        resolveTenantForHost: async (host) => {
          resolvedHost = host;

          return {
            ok: true,
            context: resolvedTenantContext,
          };
        },
        createMerchantProductCategory: async (input) => {
          categoryInput = input;

          return {
            ok: true,
            category: {
              id: "pcat_1",
              name: input.name,
              handle: input.handle ?? null,
              isActive: true,
              isInternal: false,
              parentCategoryId: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/product-categories", {
      body: JSON.stringify({
        name: "Coffee",
        handle: "coffee",
      }),
      headers: {
        "content-type": "application/json",
        cookie: "better-auth.session_token=session_1",
        Host: "platform.lvh.me",
        "x-forwarded-host": "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.equal(resolvedHost, "abebe.lvh.me");
    assert.equal(sessionCookie, "better-auth.session_token=session_1");
    assert.deepEqual(authorizationInput, {
      permission: { products: ["create"] },
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(categoryInput, {
      name: "Coffee",
      handle: "coffee",
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      category: {
        id: "pcat_1",
        name: "Coffee",
        handle: "coffee",
        isActive: true,
        isInternal: false,
        parentCategoryId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("rejects merchant product category creation without a name", async () => {
    let categoryCalls = 0;
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
        createMerchantProductCategory: async () => {
          categoryCalls += 1;

          return {
            ok: false,
            error: "commerce_backend_unavailable",
            status: 503,
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/product-categories", {
      body: JSON.stringify({
        handle: "coffee",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 400);
    assert.equal(categoryCalls, 0);
    assert.deepEqual(await response.json(), {
      error: "missing_name",
    });
  });

  it("creates merchant product collections scoped to the resolved tenant", async () => {
    let resolvedHost: string | undefined;
    let sessionCookie: string | null = null;
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let collectionInput:
      | {
          handle?: string | null | undefined;
          tenantId: string;
          title: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
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
        getSession: async (headers) => {
          sessionCookie = headers.get("cookie");

          return {
            user: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
            },
          };
        },
        resolveTenantForHost: async (host) => {
          resolvedHost = host;

          return {
            ok: true,
            context: resolvedTenantContext,
          };
        },
        createMerchantProductCollection: async (input) => {
          collectionInput = input;

          return {
            ok: true,
            collection: {
              id: "pcol_1",
              title: input.title,
              handle: input.handle ?? null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/product-collections", {
      body: JSON.stringify({
        title: "Featured",
        handle: "featured",
      }),
      headers: {
        "content-type": "application/json",
        cookie: "better-auth.session_token=session_1",
        Host: "platform.lvh.me",
        "x-forwarded-host": "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.equal(resolvedHost, "abebe.lvh.me");
    assert.equal(sessionCookie, "better-auth.session_token=session_1");
    assert.deepEqual(authorizationInput, {
      permission: { products: ["create"] },
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(collectionInput, {
      title: "Featured",
      handle: "featured",
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      collection: {
        id: "pcol_1",
        title: "Featured",
        handle: "featured",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("rejects merchant product collection creation without a title", async () => {
    let collectionCalls = 0;
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
        createMerchantProductCollection: async () => {
          collectionCalls += 1;

          return {
            ok: false,
            error: "commerce_backend_unavailable",
            status: 503,
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/product-collections", {
      body: JSON.stringify({
        handle: "featured",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 400);
    assert.equal(collectionCalls, 0);
    assert.deepEqual(await response.json(), {
      error: "missing_title",
    });
  });
});
