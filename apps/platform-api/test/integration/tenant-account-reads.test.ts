import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution } from "../support/platform-app-harness.js";

describe("tenant account reads", () => {
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
      permission: { notifications: ["read"] },
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
              funnel: [
                { count: 7, key: "storefront_visits" },
                { count: 0, key: "product_views" },
                { count: 0, key: "add_to_cart" },
                { count: 0, key: "checkout_started" },
                { count: 0, key: "orders_created" },
              ],
              coverage: {
                lastEventAt: "2026-06-29T10:00:00.000Z",
                status: "observed",
              },
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
      permission: { insights: ["read"] },
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
        funnel: [
          { count: 7, key: "storefront_visits" },
          { count: 0, key: "product_views" },
          { count: 0, key: "add_to_cart" },
          { count: 0, key: "checkout_started" },
          { count: 0, key: "orders_created" },
        ],
        coverage: {
          lastEventAt: "2026-06-29T10:00:00.000Z",
          status: "observed",
        },
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
});
