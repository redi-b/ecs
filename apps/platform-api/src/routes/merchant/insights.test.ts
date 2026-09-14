import assert from "node:assert/strict";
import { it } from "node:test";
import { appWithResolution, resolvedTenantContext } from "../../test/platform-app-harness.js";
import { createInsightsSalesService } from "../../modules/analytics/insights-sales.js";
import { createInsightsProductsService } from "../../modules/analytics/insights-products.js";
import { createInsightsStorefrontService } from "../../modules/analytics/insights-storefront.js";
import { createInsightsDemandService } from "../../modules/analytics/insights-demand.js";

it("authorizes Insights independently of Overview and binds both endpoints to the authorized tenant", async () => {
  const reads: string[] = [];
  let allowed = true;
  let signedIn = true;
  const app = appWithResolution(
    { ok: true, context: resolvedTenantContext },
    {
      getSession: async () =>
        signedIn ? { user: { id: "user_1", email: "reader@example.com", name: "Reader" } } : null,
      authorizeDashboardForTenant: async (input) => {
        assert.deepEqual(input.permission, { insights: ["read"] });
        return allowed
          ? {
              ok: true,
              actor: { id: "user_1", email: "reader@example.com", name: "Reader", role: "viewer" },
            }
          : { ok: false, error: "dashboard_forbidden", status: 403 };
      },
      getInsightsSales: createInsightsSalesService(
        async (input) => {
          reads.push(input.tenantId);
          return { checkpoint: null, rows: [] };
        },
        () => new Date("2026-09-14T08:00:00Z"),
      ),
      getInsightsStorefront: createInsightsStorefrontService(
        async (input) => {
          reads.push(input.tenantId);
          return { stages: [], rows: [], count: 0, recordedEvents: 0, eventsWithoutSession: 0 };
        },
        () => new Date("2026-09-14T08:00:00Z"),
      ),
      getInsightsProducts: createInsightsProductsService(
        async (input) => {
          reads.push(input.tenantId);
          return { checkpoint: null, count: 0, rows: [] };
        },
        () => new Date("2026-09-14T08:00:00Z"),
      ),
      getInsightsDemand: createInsightsDemandService(
        async (input) => {
          reads.push(input.tenantId);
          return {
            checkpoint: null,
            count: 0,
            rows: [],
            tracking: { recordedEvents: 0, unlinkedEvents: 0, eventsWithoutSession: 0 },
          };
        },
        () => new Date("2026-09-14T08:00:00Z"),
      ),
    },
  );
  const query = "?from=2026-09-01&to=2026-09-13";
  const host = { Host: "abebe.lvh.me" };
  const response = await app.request(`/platform/merchant/insights/sales${query}`, {
    headers: host,
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.json()).tenantId, resolvedTenantContext.tenantId);
  const scoped = await app.request(`/platform/tenants/other_shop/insights/sales${query}`, {
    headers: host,
  });
  assert.equal(scoped.status, 200);
  assert.deepEqual(reads, [resolvedTenantContext.tenantId, "other_shop"]);
  for (const path of [
    "/platform/merchant/insights/demand",
    "/platform/tenants/other_shop/insights/demand",
    "/platform/merchant/insights/storefront",
    "/platform/tenants/other_shop/insights/storefront",
    "/platform/merchant/insights/products",
    "/platform/tenants/other_shop/insights/products",
  ]) {
    assert.equal((await app.request(path + query, { headers: host })).status, 200);
  }
  allowed = false;
  for (const path of [
    "/platform/merchant/insights/demand",
    "/platform/tenants/other_shop/insights/demand",
    "/platform/merchant/insights/storefront",
    "/platform/tenants/other_shop/insights/storefront",
    "/platform/merchant/insights/sales",
    "/platform/tenants/other_shop/insights/sales",
    "/platform/merchant/insights/products",
    "/platform/tenants/other_shop/insights/products",
  ]) {
    assert.equal((await app.request(path + query, { headers: host })).status, 403);
  }
  signedIn = false;
  assert.equal(
    (await app.request(`/platform/merchant/insights/sales${query}`, { headers: host })).status,
    401,
  );
  assert.equal(reads.length, 8);
});
