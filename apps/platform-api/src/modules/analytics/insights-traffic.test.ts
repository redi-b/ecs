import assert from "node:assert/strict";
import test from "node:test";
import { insightsStorefrontQuerySchema, insightsTrafficSchema } from "@ecs/contracts";
import { createInsightsTrafficReader } from "./insights-traffic.js";
import type { StorefrontAnalyticsProvider } from "./providers/types.js";

const query = insightsStorefrontQuerySchema.parse({ from: "2026-09-01", to: "2026-09-13" });
function provider(
  overrides: Partial<StorefrontAnalyticsProvider> = {},
): StorefrontAnalyticsProvider {
  return {
    ensureSite: async () => {
      throw new Error("report must not provision");
    },
    provisionSite: async () => {
      throw new Error("report must not provision");
    },
    trackEvent: async () => {},
    getTimeSeries: async () => [],
    getTrafficSummary: async ({ range, siteId }) => {
      assert.equal(siteId, "shop_1");
      assert.equal(range.from.toISOString(), "2026-08-31T21:00:00.000Z");
      assert.equal(range.to.toISOString(), "2026-09-13T20:59:59.999Z");
      return {
        visitors: 10,
        visits: 12,
        pageViews: 30,
        bounceRate: null,
        visitDurationSeconds: null,
      };
    },
    getDimensions: async () => [{ key: "https://example.com/path?token=secret", visits: 4 }],
    ...overrides,
  };
}
test("uses selected Ethiopian days and tenant site without provisioning or leaking URL details", async () => {
  const result = await createInsightsTrafficReader(provider())({ tenantId: "shop_1", query });
  assert.ok(insightsTrafficSchema.safeParse(result).success);
  assert.equal(result.status, "available");
  assert.deepEqual(result.rows, [{ key: "example.com", visitors: 4 }]);
});
test("bounds and labels searchable provider results, with stable page counts", async () => {
  const reader = createInsightsTrafficReader(
    provider({
      getDimensions: async ({ limit }) => {
        assert.equal(limit, 501);
        return Array.from({ length: 501 }, (_, i) => ({ key: `source${i}.com`, visits: 501 - i }));
      },
    }),
  );
  const result = await reader({ tenantId: "shop_1", query: { ...query, trafficPage: 25 } });
  assert.equal(result.limited, true);
  assert.equal(result.count, 500);
  assert.equal(result.rows.length, 20);
  const filtered = await reader({
    tenantId: "shop_1",
    query: { ...query, trafficSearch: "source499" },
  });
  assert.equal(filtered.count, 1);
});
test("contains provider outages and invalid responses without pretending traffic is zero", async () => {
  for (const failing of [
    provider({
      getDimensions: async () => {
        throw new Error("offline");
      },
    }),
    provider({ getDimensions: async () => [{ key: "bad", visits: -1 }] }),
  ]) {
    const result = await createInsightsTrafficReader(failing)({ tenantId: "shop_1", query });
    assert.equal(result.status, "unavailable");
    assert.equal(result.summary, null);
  }
  assert.equal(
    (await createInsightsTrafficReader(null)({ tenantId: "shop_1", query })).status,
    "not_configured",
  );
});
