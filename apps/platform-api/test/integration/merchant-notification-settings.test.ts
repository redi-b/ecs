import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("merchant notification settings", () => {
  it("requires a platform session for merchant dashboard access", async () => {
    const app = appWithResolution({
      ok: true,
      context: resolvedTenantContext,
    });

    const response = await app.request("/platform/merchant/dashboard", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "auth_required",
    });
  });

  it("lists merchant notification preferences for the resolved tenant", async () => {
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
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
        listNotificationPreferences: async (input) => {
          assert.equal(input.tenantId, "tenant_1");

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

    const response = await app.request("/platform/merchant/notifications/preferences", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      channels: {
        email: { available: true },
        telegram: { available: true },
      },
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

  it("upserts merchant notification preferences for the resolved tenant", async () => {
    const upserts: {
      channel: string;
      enabled: boolean;
      events: string[];
      target: string;
      tenantId: string;
      userId: string;
    }[] = [];
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
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
          upserts.push(input);

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

    const response = await app.request("/platform/merchant/notifications/preferences", {
      body: JSON.stringify({
        channel: "telegram",
        enabled: true,
        events: ["cod_order.created", "order.created"],
        target: "@abebe_market",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(upserts, [
      {
        channel: "telegram",
        enabled: true,
        events: ["cod_order.created", "order.created"],
        target: "@abebe_market",
        tenantId: "tenant_1",
        userId: "user_1",
      },
    ]);
    assert.deepEqual(await response.json(), {
      preference: {
        id: "np_1",
        channel: "telegram",
        enabled: true,
        events: ["cod_order.created", "order.created"],
        target: "@abebe_market",
        updatedAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("rejects actors without active membership for the resolved tenant", async () => {
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({ ok: false }),
        getSession: async () => ({
          user: {
            id: "user_2",
            email: "stranger@example.com",
            name: "Stranger",
          },
        }),
      },
    );

    const response = await app.request("/platform/merchant/dashboard", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "dashboard_forbidden",
    });
  });
});
