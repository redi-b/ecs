import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appWithResolution,
  type MerchantOrderAction,
  resolvedTenantContext,
} from "./test/platform-app-harness.js";

describe("platform app merchant dashboard and orders", () => {
  it("returns a merchant dashboard summary for the resolved shop host", async () => {
    let authorizationInput: { tenantId: string; userId: string } | undefined;
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
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
      },
    );

    const response = await app.request("/platform/merchant/dashboard", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(authorizationInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
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
      operations: {
        range: {
          label: "Recent orders",
          days: 90,
          sampledOrderCount: 0,
        },
        totals: {
          revenue: 0,
          orders: null,
          products: null,
          customers: null,
          currencyCode: null,
        },
        attention: {
          unfulfilledOrders: null,
          unpaidOrders: null,
          draftProducts: null,
        },
        customers: {
          unique: null,
          repeat: null,
        },
        breakdowns: {
          orderStatus: [],
          paymentStatus: [],
          fulfillmentStatus: [],
        },
        series: [],
        recentOrders: [],
        unavailable: ["orders", "products"],
      },
      analytics: {
        range: {
          days: 30,
          from: "1970-01-01T00:00:00.000Z",
          to: "1970-01-01T00:00:00.000Z",
        },
        totals: {
          events: 0,
          storefrontEvents: 0,
          platformEvents: 0,
          medusaEvents: 0,
        },
        topEvents: [],
        unavailable: true,
      },
      billing: {
        subscription: null,
        plan: null,
        invoices: [],
        unavailable: true,
      },
    });
  });

  it("returns a merchant dashboard summary for the selected tenant", async () => {
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let summaryInput: { tenantId: string } | undefined;
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
        getTenantDashboardSummary: async (input) => {
          summaryInput = input;

          return {
            ok: true,
            summary: {
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
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/dashboard");

    assert.equal(response.status, 200);
    assert.deepEqual(authorizationInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(summaryInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
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
    });
  });

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
            redirectTo: "//new-abebe.lvh.me/admin/settings",
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
      redirectTo: "//new-abebe.lvh.me/admin/settings",
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

  it("lists merchant orders scoped to the resolved tenant sales channel", async () => {
    let ordersInput:
      | {
          limit: number;
          offset: number;
          salesChannelId: string;
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
        listMerchantOrders: async (input) => {
          ordersInput = input;

          return {
            ok: true,
            count: 1,
            limit: input.limit,
            offset: input.offset,
            orders: [
              {
                id: "order_1",
                displayId: 1001,
                email: "customer@example.com",
                status: "pending",
                paymentStatus: "awaiting",
                fulfillmentStatus: "not_fulfilled",
                currencyCode: "etb",
                total: 1250,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/orders?limit=5&offset=10", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(ordersInput, {
      limit: 5,
      offset: 10,
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      orders: [
        {
          id: "order_1",
          displayId: 1001,
          email: "customer@example.com",
          status: "pending",
          paymentStatus: "awaiting",
          fulfillmentStatus: "not_fulfilled",
          currencyCode: "etb",
          total: 1250,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 1,
      limit: 5,
      offset: 10,
    });
  });

  it("requires a platform session for merchant order access", async () => {
    const app = appWithResolution({
      ok: true,
      context: resolvedTenantContext,
    });

    const response = await app.request("/platform/merchant/orders", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "auth_required",
    });
  });

  it("returns merchant order details scoped to the resolved tenant sales channel", async () => {
    let orderInput:
      | {
          orderId: string;
          salesChannelId: string;
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
        getMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "pending",
              paymentStatus: "awaiting",
              fulfillmentStatus: "not_fulfilled",
              currencyCode: "etb",
              total: 1250,
              delivery: {
                choice: "delivery",
                customerName: "Abebe Kebede",
                customerPhone: "+251911111111",
                landmark: "Blue gate",
                notes: "Call before arrival",
              },
              items: [
                {
                  id: "item_1",
                  title: "Coffee",
                  quantity: 2,
                  unitPrice: 500,
                  total: 1000,
                  thumbnail: null,
                },
              ],
              shippingAddress: {
                firstName: "Abebe",
                lastName: "Kebede",
                phone: "+251911111111",
                address1: "Bole Road",
                address2: null,
                city: "Addis Ababa",
                province: null,
                postalCode: null,
                countryCode: "et",
              },
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/orders/order_1", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(orderInput, {
      orderId: "order_1",
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "pending",
        paymentStatus: "awaiting",
        fulfillmentStatus: "not_fulfilled",
        currencyCode: "etb",
        total: 1250,
        delivery: {
          choice: "delivery",
          customerName: "Abebe Kebede",
          customerPhone: "+251911111111",
          landmark: "Blue gate",
          notes: "Call before arrival",
        },
        items: [
          {
            id: "item_1",
            title: "Coffee",
            quantity: 2,
            unitPrice: 500,
            total: 1000,
            thumbnail: null,
          },
        ],
        shippingAddress: {
          firstName: "Abebe",
          lastName: "Kebede",
          phone: "+251911111111",
          address1: "Bole Road",
          address2: null,
          city: "Addis Ababa",
          province: null,
          postalCode: null,
          countryCode: "et",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("completes merchant orders scoped to the resolved tenant sales channel", async () => {
    let orderInput:
      | {
          action: MerchantOrderAction;
          orderId: string;
          salesChannelId: string;
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
        mutateMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "completed",
              paymentStatus: "captured",
              fulfillmentStatus: "fulfilled",
              currencyCode: "etb",
              total: 1250,
              items: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/orders/order_1/complete", {
      headers: {
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(orderInput, {
      action: "complete",
      orderId: "order_1",
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "completed",
        paymentStatus: "captured",
        fulfillmentStatus: "fulfilled",
        currencyCode: "etb",
        total: 1250,
        items: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("fulfills merchant orders from the resolved tenant stock location", async () => {
    let orderInput:
      | {
          action: MerchantOrderAction;
          orderId: string;
          salesChannelId: string;
          stockLocationId?: string | undefined;
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
        mutateMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "pending",
              paymentStatus: "captured",
              fulfillmentStatus: "fulfilled",
              currencyCode: "etb",
              total: 1250,
              items: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/orders/order_1/fulfill", {
      headers: {
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(orderInput, {
      action: "fulfill",
      orderId: "order_1",
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "pending",
        paymentStatus: "captured",
        fulfillmentStatus: "fulfilled",
        currencyCode: "etb",
        total: 1250,
        items: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("marks merchant order fulfillments as delivered for the resolved tenant", async () => {
    let orderInput:
      | {
          action: MerchantOrderAction;
          fulfillmentId?: string | undefined;
          orderId: string;
          salesChannelId: string;
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
        mutateMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "pending",
              paymentStatus: "captured",
              fulfillmentStatus: "delivered",
              currencyCode: "etb",
              total: 1250,
              fulfillments: [
                {
                  id: "ful_1",
                  deliveredAt: "2026-01-03T00:00:00.000Z",
                  shippedAt: null,
                  canceledAt: null,
                },
              ],
              items: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-03T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request(
      "/platform/merchant/orders/order_1/fulfillments/ful_1/deliver",
      {
        headers: {
          Host: "abebe.lvh.me",
        },
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(orderInput, {
      action: "deliver",
      fulfillmentId: "ful_1",
      orderId: "order_1",
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "pending",
        paymentStatus: "captured",
        fulfillmentStatus: "delivered",
        currencyCode: "etb",
        total: 1250,
        fulfillments: [
          {
            id: "ful_1",
            deliveredAt: "2026-01-03T00:00:00.000Z",
            shippedAt: null,
            canceledAt: null,
          },
        ],
        items: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    });
  });

  it("lists tenant orders scoped to the selected tenant sales channel", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let ordersInput:
      | {
          limit: number;
          offset: number;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        listMerchantOrders: async (input) => {
          ordersInput = input;

          return {
            ok: true,
            count: 1,
            limit: input.limit,
            offset: input.offset,
            orders: [
              {
                id: "order_1",
                displayId: 1001,
                email: "customer@example.com",
                status: "pending",
                paymentStatus: "awaiting",
                fulfillmentStatus: "not_fulfilled",
                currencyCode: "etb",
                total: 1250,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/orders?limit=5&offset=10");

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(ordersInput, {
      limit: 5,
      offset: 10,
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      orders: [
        {
          id: "order_1",
          displayId: 1001,
          email: "customer@example.com",
          status: "pending",
          paymentStatus: "awaiting",
          fulfillmentStatus: "not_fulfilled",
          currencyCode: "etb",
          total: 1250,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 1,
      limit: 5,
      offset: 10,
    });
  });

  it("returns tenant order details scoped to the selected tenant sales channel", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let orderInput:
      | {
          orderId: string;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        getMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "pending",
              paymentStatus: "awaiting",
              fulfillmentStatus: "not_fulfilled",
              currencyCode: "etb",
              total: 1250,
              items: [
                {
                  id: "item_1",
                  title: "Coffee",
                  quantity: 2,
                  unitPrice: 500,
                  total: 1000,
                  thumbnail: null,
                },
              ],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/orders/order_1");

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(orderInput, {
      orderId: "order_1",
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "pending",
        paymentStatus: "awaiting",
        fulfillmentStatus: "not_fulfilled",
        currencyCode: "etb",
        total: 1250,
        items: [
          {
            id: "item_1",
            title: "Coffee",
            quantity: 2,
            unitPrice: 500,
            total: 1000,
            thumbnail: null,
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("cancels tenant orders scoped to the selected tenant sales channel", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let orderInput:
      | {
          action: MerchantOrderAction;
          orderId: string;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        mutateMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "canceled",
              paymentStatus: "canceled",
              fulfillmentStatus: "not_fulfilled",
              currencyCode: "etb",
              total: 1250,
              items: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/orders/order_1/cancel", {
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(orderInput, {
      action: "cancel",
      orderId: "order_1",
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "canceled",
        paymentStatus: "canceled",
        fulfillmentStatus: "not_fulfilled",
        currencyCode: "etb",
        total: 1250,
        items: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("fulfills tenant orders scoped to the selected tenant stock location", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let orderInput:
      | {
          action: MerchantOrderAction;
          orderId: string;
          salesChannelId: string;
          stockLocationId?: string | undefined;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaStockLocationId: "sloc_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        mutateMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "pending",
              paymentStatus: "captured",
              fulfillmentStatus: "fulfilled",
              currencyCode: "etb",
              total: 1250,
              items: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/orders/order_1/fulfill", {
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(orderInput, {
      action: "fulfill",
      orderId: "order_1",
      salesChannelId: "channel_1",
      stockLocationId: "sloc_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "pending",
        paymentStatus: "captured",
        fulfillmentStatus: "fulfilled",
        currencyCode: "etb",
        total: 1250,
        items: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("marks tenant order fulfillments as delivered for the selected tenant", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let orderInput:
      | {
          action: MerchantOrderAction;
          fulfillmentId?: string | undefined;
          orderId: string;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        mutateMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "pending",
              paymentStatus: "captured",
              fulfillmentStatus: "delivered",
              currencyCode: "etb",
              total: 1250,
              fulfillments: [
                {
                  id: "ful_1",
                  deliveredAt: "2026-01-03T00:00:00.000Z",
                  shippedAt: null,
                  canceledAt: null,
                },
              ],
              items: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-03T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request(
      "/platform/tenants/tenant_1/orders/order_1/fulfillments/ful_1/deliver",
      {
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(orderInput, {
      action: "deliver",
      fulfillmentId: "ful_1",
      orderId: "order_1",
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "pending",
        paymentStatus: "captured",
        fulfillmentStatus: "delivered",
        currencyCode: "etb",
        total: 1250,
        fulfillments: [
          {
            id: "ful_1",
            deliveredAt: "2026-01-03T00:00:00.000Z",
            shippedAt: null,
            canceledAt: null,
          },
        ],
        items: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    });
  });
});
