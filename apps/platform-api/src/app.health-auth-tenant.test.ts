import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "./test/platform-app-harness.js";

describe("platform app health, auth, and tenant bootstrap", () => {
  it("returns health status", async () => {
    const app = appWithResolution({ ok: false, error: "shop_context_required" });

    const response = await app.request("/health");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "platform-api",
    });
  });

  it("adds request ids to platform responses and platform-owned errors", async () => {
    const app = appWithResolution({ ok: false, error: "shop_context_required" });

    const response = await app.request("/platform/me", {
      headers: {
        "x-request-id": "req_test_1",
      },
    });

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("x-request-id"), "req_test_1");
    assert.deepEqual(await response.json(), {
      error: "auth_required",
      requestId: "req_test_1",
    });
  });

  it("handles Chapa payment callbacks with verified payment state", async () => {
    let callbackInput:
      | {
          providerReference?: string | null | undefined;
          reportedStatus?: string | null | undefined;
          tenantId?: string | null | undefined;
          txRef?: string | null | undefined;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        handleChapaPaymentCallback: async (input) => {
          callbackInput = input;

          return {
            ok: true,
            eventType: "payment.paid",
            providerReference: "chapa_ref_1",
            status: "success",
            tenantId: "tenant_1",
            txRef: "tx_1",
          };
        },
      },
    );

    const response = await app.request(
      "/platform/payments/chapa/callback?trx_ref=tx_1&ref_id=chapa_ref_1&status=success&tenant_id=tenant_1",
    );

    assert.equal(response.status, 200);
    assert.deepEqual(callbackInput, {
      providerReference: "chapa_ref_1",
      reportedStatus: "success",
      tenantId: "tenant_1",
      txRef: "tx_1",
    });
    assert.deepEqual(await response.json(), {
      payment: {
        eventType: "payment.paid",
        providerReference: "chapa_ref_1",
        status: "success",
        tenantId: "tenant_1",
        txRef: "tx_1",
      },
    });
  });

  it("rejects Chapa callbacks without tenant context", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        handleChapaPaymentCallback: async () => ({
          ok: false,
          error: "missing_tenant_context",
          status: 400,
        }),
      },
    );

    const response = await app.request("/platform/payments/chapa/callback?trx_ref=tx_1");

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "missing_tenant_context",
    });
  });

  it("returns shop_context_required for central store requests without trusted shop context", async () => {
    const app = appWithResolution({ ok: false, error: "shop_context_required" });

    const response = await app.request("/store/products", {
      headers: {
        Host: "api.lvh.me",
      },
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "shop_context_required",
    });
  });

  it("returns shop_not_found for unknown storefront hosts", async () => {
    const app = appWithResolution({ ok: false, error: "shop_not_found" });

    const response = await app.request("/store/products", {
      headers: {
        Host: "missing.lvh.me",
      },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "shop_not_found",
    });
  });

  it("records storefront analytics events for the resolved host tenant", async () => {
    let recordedEvent:
      | {
          customerId?: string | null | undefined;
          eventType: string;
          idempotencyKey?: string | null | undefined;
          occurredAt?: string | null | undefined;
          properties?: unknown;
          sessionId?: string | null | undefined;
          source: "medusa" | "platform" | "storefront";
          subjectId?: string | null | undefined;
          subjectType?: string | null | undefined;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        recordAnalyticsEvent: async (input) => {
          recordedEvent = input;

          return {
            ok: true,
            duplicate: false,
            event: {
              id: "event_1",
              eventType: "storefront.page_viewed",
              occurredAt: "2026-01-01T12:00:00.000Z",
              receivedAt: "2026-01-01T12:00:01.000Z",
              source: "storefront",
            },
          };
        },
      },
    );

    const response = await app.request("/store/analytics/events", {
      body: JSON.stringify({
        eventType: "storefront.page_viewed",
        idempotencyKey: "view-1",
        occurredAt: "2026-01-01T12:00:00.000Z",
        properties: {
          path: "/products/coffee",
          tenantId: "tenant_from_body_should_be_ignored",
        },
        sessionId: "anonymous-session-1",
        tenantId: "tenant_from_body_should_be_ignored",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 202);
    assert.deepEqual(recordedEvent, {
      customerId: null,
      eventType: "storefront.page_viewed",
      idempotencyKey: "view-1",
      occurredAt: "2026-01-01T12:00:00.000Z",
      properties: {
        path: "/products/coffee",
        tenantId: "tenant_from_body_should_be_ignored",
      },
      sessionId: "anonymous-session-1",
      source: "storefront",
      subjectId: null,
      subjectType: null,
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      event: {
        duplicate: false,
        id: "event_1",
      },
    });
  });

  it("mounts platform auth routes", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authHandler: async (request) =>
          Response.json({
            method: request.method,
            path: new URL(request.url).pathname,
          }),
      },
    );

    const response = await app.request("/platform/auth/get-session");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      method: "GET",
      path: "/platform/auth/get-session",
    });
  });

  it("returns the current platform session user", async () => {
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
      },
    );

    const response = await app.request("/platform/me");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      user: {
        id: "user_1",
        email: "owner@abebe.local",
        name: "Abebe Owner",
      },
    });
  });

  it("lists tenant shops for the current platform user", async () => {
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
        listTenantsForUser: async (input) => {
          listInput = input;

          return {
            ok: true,
            count: 1,
            limit: input.limit,
            offset: input.offset,
            tenants: [
              {
                id: "tenant_1",
                name: "Abebe Market",
                handle: "abebe",
                status: "active",
                role: "owner",
                primaryDomain: {
                  hostname: "abebe.lvh.me",
                },
                createdAt: "2026-06-30T08:00:00.000Z",
                updatedAt: "2026-06-30T08:10:00.000Z",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/tenants?limit=5&offset=10");

    assert.equal(response.status, 200);
    assert.deepEqual(listInput, {
      limit: 5,
      offset: 10,
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      tenants: [
        {
          id: "tenant_1",
          name: "Abebe Market",
          handle: "abebe",
          status: "active",
          role: "owner",
          primaryDomain: {
            hostname: "abebe.lvh.me",
          },
          createdAt: "2026-06-30T08:00:00.000Z",
          updatedAt: "2026-06-30T08:10:00.000Z",
        },
      ],
      count: 1,
      limit: 5,
      offset: 10,
    });
  });

  it("returns onboarding state for the current platform user", async () => {
    let stateInput: { userId: string } | undefined;
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
        getOnboardingState: async (input) => {
          stateInput = input;

          return {
            ok: true,
            state: {
              user: {
                id: "user_1",
                email: "owner@abebe.local",
                name: "Abebe Owner",
              },
              tenants: [],
              primaryTenant: null,
              latestProvisioningAttempt: null,
            },
          };
        },
      },
    );

    const response = await app.request("/platform/onboarding/state");

    assert.equal(response.status, 200);
    assert.deepEqual(stateInput, {
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      user: {
        id: "user_1",
        email: "owner@abebe.local",
        name: "Abebe Owner",
      },
      tenants: [],
      primaryTenant: null,
      latestProvisioningAttempt: null,
    });
  });

  it("checks tenant handle availability", async () => {
    let availabilityInput: { handle: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        checkTenantHandleAvailability: async (input) => {
          availabilityInput = input;

          return {
            handle: "new-shop",
            available: true,
            hostname: "new-shop.lvh.me",
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/handle-availability?handle=new-shop");

    assert.equal(response.status, 200);
    assert.deepEqual(availabilityInput, {
      handle: "new-shop",
    });
    assert.deepEqual(await response.json(), {
      handle: "new-shop",
      available: true,
      hostname: "new-shop.lvh.me",
    });
  });

  it("returns one tenant shop for the current platform user", async () => {
    let detailInput: { tenantId: string; userId: string } | undefined;
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
        getTenantForUser: async (input) => {
          detailInput = input;

          return {
            ok: true,
            tenant: {
              id: "tenant_1",
              name: "Abebe Market",
              handle: "abebe",
              status: "active",
              role: "owner",
              primaryDomain: {
                hostname: "abebe.lvh.me",
              },
              createdAt: "2026-06-30T08:00:00.000Z",
              updatedAt: "2026-06-30T08:10:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1");

    assert.equal(response.status, 200);
    assert.deepEqual(detailInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      tenant: {
        id: "tenant_1",
        name: "Abebe Market",
        handle: "abebe",
        status: "active",
        role: "owner",
        primaryDomain: {
          hostname: "abebe.lvh.me",
        },
        createdAt: "2026-06-30T08:00:00.000Z",
        updatedAt: "2026-06-30T08:10:00.000Z",
      },
    });
  });

  it("does not return a tenant shop outside the current user's memberships", async () => {
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
        getTenantForUser: async () => ({
          ok: false,
          error: "tenant_not_found",
          status: 404,
        }),
      },
    );

    const response = await app.request("/platform/tenants/tenant_2");

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "tenant_not_found",
    });
  });

  it("lists tenant notification preferences for an authorized tenant member", async () => {
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let listInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async (input) => {
          authorizationInput = input;

          return {
            ok: true,
            actor: {
              id: "member_1",
              email: "owner@example.com",
              name: "Owner",
              role: "owner",
            },
          };
        },
        getSession: async () => ({
          user: { id: "user_1", email: "owner@example.com", name: "Owner" },
        }),
        listNotificationPreferences: async (input) => {
          listInput = input;

          return {
            ok: true,
            preferences: [
              {
                id: "np_1",
                channel: "telegram",
                enabled: true,
                events: ["cod_order.created", "order.created"],
                target: "@abebe_market",
                updatedAt: "2026-06-02T10:00:00.000Z",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/notifications/preferences");

    assert.equal(response.status, 200);
    assert.deepEqual(authorizationInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(listInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      preferences: [
        {
          id: "np_1",
          channel: "telegram",
          enabled: true,
          events: ["cod_order.created", "order.created"],
          target: "@abebe_market",
          updatedAt: "2026-06-02T10:00:00.000Z",
        },
      ],
    });
  });

  it("upserts tenant notification preferences for an authorized tenant member", async () => {
    let upsertInput:
      | {
          channel: string;
          enabled: boolean;
          events: string[];
          target: string;
          tenantId: string;
          userId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "member_1",
            email: "owner@example.com",
            name: "Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@example.com", name: "Owner" },
        }),
        upsertNotificationPreference: async (input) => {
          upsertInput = input;

          return {
            ok: true,
            preference: {
              id: "np_1",
              channel: input.channel,
              enabled: input.enabled,
              events: input.events,
              target: input.target,
              updatedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/notifications/preferences", {
      body: JSON.stringify({
        channel: "telegram",
        enabled: false,
        events: ["cod_order.created"],
        target: "@abebe_market",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(upsertInput, {
      channel: "telegram",
      enabled: false,
      events: ["cod_order.created"],
      target: "@abebe_market",
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      preference: {
        id: "np_1",
        channel: "telegram",
        enabled: false,
        events: ["cod_order.created"],
        target: "@abebe_market",
        updatedAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("returns tenant insights summary for an authorized tenant member", async () => {
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let summaryInput: { days: number; tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async (input) => {
          authorizationInput = input;

          return {
            ok: true,
            actor: {
              id: "member_1",
              email: "owner@example.com",
              name: "Owner",
              role: "owner",
            },
          };
        },
        getSession: async () => ({
          user: { id: "user_1", email: "owner@example.com", name: "Owner" },
        }),
        getTenantInsightsSummary: async (input) => {
          summaryInput = input;

          return {
            ok: true,
            summary: {
              tenantId: input.tenantId,
              range: {
                days: input.days,
                from: "2026-06-23T00:00:00.000Z",
                to: "2026-06-30T00:00:00.000Z",
              },
              totals: {
                events: 12,
                medusaEvents: 2,
                platformEvents: 3,
                storefrontEvents: 7,
              },
              topEvents: [
                {
                  eventType: "storefront.page_viewed",
                  count: 7,
                },
              ],
              recentEvents: [
                {
                  id: "event_1",
                  eventType: "storefront.page_viewed",
                  occurredAt: "2026-06-29T10:00:00.000Z",
                  source: "storefront",
                  subjectId: null,
                  subjectType: null,
                },
              ],
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/insights/summary?days=7");

    assert.equal(response.status, 200);
    assert.deepEqual(authorizationInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(summaryInput, {
      days: 7,
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      summary: {
        tenantId: "tenant_1",
        range: {
          days: 7,
          from: "2026-06-23T00:00:00.000Z",
          to: "2026-06-30T00:00:00.000Z",
        },
        totals: {
          events: 12,
          medusaEvents: 2,
          platformEvents: 3,
          storefrontEvents: 7,
        },
        topEvents: [
          {
            eventType: "storefront.page_viewed",
            count: 7,
          },
        ],
        recentEvents: [
          {
            id: "event_1",
            eventType: "storefront.page_viewed",
            occurredAt: "2026-06-29T10:00:00.000Z",
            source: "storefront",
            subjectId: null,
            subjectType: null,
          },
        ],
      },
    });
  });

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
            templateKey: "classic@1",
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
        templateKey: "classic@1",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      redirectTo: "http://new-shop.lvh.me/admin",
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
});
