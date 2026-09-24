import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("merchant dashboard overview", () => {
  it("reads the current draft count after publishing instead of the reporting snapshot", async () => {
    let draftCount = 1;
    let catalogUnavailable = false;
    let publishedUnavailable = false;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Owner", role: "owner" },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Owner" },
        }),
        getDashboardMetrics: async () => ({
          ok: true,
          metrics: {
            attention: { draftProducts: 1, unfulfilledOrders: 0, unpaidOrders: 0 },
            breakdowns: { fulfillmentStatus: [], orderStatus: [], paymentStatus: [] },
            currencyCode: "etb",
            customers: { repeat: 0, unique: 0 },
            products: 1,
            series: [],
            quality: {
              lastSuccessfulAt: null,
              rollupVersion: 1,
              status: "stale",
              timezone: "Africa/Addis_Ababa",
              watermark: null,
            },
          },
        }),
        listMerchantProducts: async (input) => {
          assert.equal(input.salesChannelId, "channel_1");
          assert.ok(["draft", "proposed", "published", "rejected"].includes(input.status ?? ""));
          if (catalogUnavailable || (publishedUnavailable && input.status === "published")) {
            return { ok: false, error: "commerce_backend_unavailable", status: 503 };
          }
          return {
            ok: true,
            products: [],
            count: input.status === "draft" ? draftCount : input.status === "published" ? 5 : 0,
            limit: input.limit,
            offset: input.offset,
          };
        },
      },
    );
    const readCount = async () => {
      const response = await app.request("/platform/merchant/dashboard", {
        headers: { Host: "abebe.lvh.me" },
      });
      assert.equal(response.status, 200);
      const { operations } = await response.json();
      if (!catalogUnavailable) {
        assert.deepEqual(operations.productStatuses, [
          { status: "draft", count: draftCount },
          { status: "proposed", count: 0 },
          { status: "published", count: 5 },
          { status: "rejected", count: 0 },
        ]);
        assert.equal(operations.totals.products, draftCount + 5);
      } else {
        assert.equal(operations.productStatuses, null);
      }
      return operations.attention.draftProducts;
    };
    assert.equal(await readCount(), 1);
    draftCount = 0;
    assert.equal(await readCount(), 0);
    publishedUnavailable = true;
    const partialResponse = await app.request("/platform/merchant/dashboard", {
      headers: { Host: "abebe.lvh.me" },
    });
    assert.equal(partialResponse.status, 200);
    const partial = (await partialResponse.json()).operations;
    assert.equal(
      partial.productStatuses,
      null,
      "Do not chart partial status counts as a complete catalog",
    );
    assert.equal(
      partial.attention.draftProducts,
      0,
      "An unavailable published count must not hide a verified draft count",
    );
    publishedUnavailable = false;
    catalogUnavailable = true;
    assert.equal(
      await readCount(),
      null,
      "Never present a stale count as current when the catalog is unavailable",
    );
  });

  it("loads the attention queue separately and preserves order product context", async () => {
    let queueRequested = false;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Owner", role: "owner" },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Owner" },
        }),
        listMerchantOrders: async (input) => {
          assert.equal(input.salesChannelId, "channel_1");
          if (!input.attentionOnly)
            return { ok: true, orders: [], count: 0, limit: input.limit, offset: 0 };
          queueRequested = true;
          assert.equal(input.limit, 12);
          return {
            ok: true,
            count: 1,
            limit: input.limit,
            offset: 0,
            orders: [
              {
                id: "order_waiting",
                customDisplayId: "SHOP-123",
                displayId: 1,
                email: "customer@example.com",
                status: "pending",
                paymentStatus: "captured",
                fulfillmentStatus: "not_fulfilled",
                currencyCode: "etb",
                total: 250,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: null,
                items: [
                  {
                    id: "item_1",
                    title: "Shirt",
                    productTitle: "Cotton shirt",
                    thumbnail: "https://example.com/shirt.jpg",
                    quantity: 2,
                    unitPrice: 125,
                    total: 250,
                  },
                ],
              },
            ],
          };
        },
      },
    );
    const response = await app.request("/platform/merchant/dashboard", {
      headers: { Host: "abebe.lvh.me" },
    });
    assert.equal(response.status, 200);
    assert.equal(queueRequested, true);
    const body = await response.json();
    assert.deepEqual(body.operations.recentOrders, []);
    assert.equal(body.operations.waitingOrders[0].customDisplayId, "SHOP-123");
    assert.deepEqual(body.operations.waitingOrders[0].reasons, ["fulfillment"]);
    assert.equal(body.operations.waitingOrders[0].productCount, 1);
    assert.deepEqual(body.operations.waitingOrders[0].products, [
      {
        id: "item_1",
        title: "Cotton shirt",
        thumbnail: "https://example.com/shirt.jpg",
        quantity: 2,
      },
    ]);
  });

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
      permission: { overview: ["read"] },
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(await response.json(), {
      tenant: {
        id: "tenant_1",
        name: "Abebe Market",
        handle: "abebe",
        status: "active",
        shopDetails: null,
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
        hasUnpublishedChanges: false,
        publishedRevisionId: "revision_1",
        publishedTemplateKey: "luvia@1",
        savedTemplateKeys: [],
        templateId: "template_1",
        templateKey: "luvia@1",
        templateVersion: 1,
      },
      operations: {
        range: {
          label: "Recent orders",
          days: 90,
          sampledOrderCount: 0,
        },
        quality: {
          lastSuccessfulAt: null,
          rollupVersion: 1,
          status: "missing",
          timezone: "Africa/Addis_Ababa",
          watermark: null,
        },
        totals: {
          revenue: null,
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
        productStatuses: null,
        breakdowns: {
          orderStatus: [],
          paymentStatus: [],
          fulfillmentStatus: [],
        },
        series: [],
        recentOrders: [],
        waitingOrders: null,
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
        funnel: [],
        storefront: {
          visits: 0,
          pageViews: 0,
          productViewVisits: 0,
          addToCartVisits: 0,
          checkoutVisits: 0,
          searchVisits: 0,
          contactVisits: 0,
        },
        products: [],
        coverage: {
          lastEventAt: null,
          status: "no_data",
        },
        unavailable: true,
      },
      billing: {
        availablePaidPlans: [],
        catalog: [],
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
                templateKey: "luvia@1",
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
      permission: { overview: ["read"] },
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
        templateKey: "luvia@1",
        templateVersion: 1,
      },
    });
  });

  it("queues an Insights refresh only for an authorized tenant", async () => {
    let refreshInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
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
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe Owner" },
        }),
        requestInsightsRefresh: async (input) => {
          refreshInput = input;
          return {
            jobId: "job_1",
            queued: true,
            requestedAt: "2026-08-26T10:07:00.000Z",
            retryAt: "2026-08-26T10:15:00.000Z",
            status: "queued",
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/insights/refresh", {
      method: "POST",
    });

    assert.equal(response.status, 202);
    assert.deepEqual(refreshInput, { tenantId: "tenant_1" });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), {
      ok: true,
      jobId: "job_1",
      queued: true,
      requestedAt: "2026-08-26T10:07:00.000Z",
      retryAt: "2026-08-26T10:15:00.000Z",
      status: "queued",
    });
  });

  it("denies an Insights refresh outside the merchant tenant", async () => {
    let requested = false;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({ ok: false }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe Owner" },
        }),
        requestInsightsRefresh: async () => {
          requested = true;
          throw new Error("must not run");
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_2/insights/refresh", {
      method: "POST",
    });

    assert.equal(response.status, 403);
    assert.equal(requested, false);
  });
});
