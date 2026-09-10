import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { StorefrontAnalyticsProvider } from "./providers/types.js";
import { createStorefrontInsightsService } from "./storefront-insights-service.js";

describe("storefront insights service", () => {
  it("returns a normalized provider snapshot", async () => {
    let provisioned: Parameters<StorefrontAnalyticsProvider["ensureSite"]>[0] | undefined;
    const service = createStorefrontInsightsService({
      provider: stubProvider({
        ensureSite: async (input) => {
          provisioned = input;
          return { siteId: "site-1" };
        },
      }),
    });
    const result = await service({
      days: 30,
      hostname: "shop.example.com",
      name: "Shop",
      tenantId: "tenant-1",
    });

    assert.equal(result.status, "available");
    assert.equal(result.traffic?.visits, 8);
    assert.deepEqual(result.dimensions.device, [{ key: "mobile", visits: 5 }]);
    assert.deepEqual(provisioned, {
      domain: "shop.example.com",
      name: "Shop",
      requestedId: "tenant-1",
    });
  });

  it("contains provider failure without hiding commerce insights", async () => {
    const service = createStorefrontInsightsService({
      provider: stubProvider({
        getTrafficSummary: async () => {
          throw new Error("offline");
        },
      }),
    });
    const result = await service({
      days: 30,
      hostname: "shop.example.com",
      name: "Shop",
      tenantId: "tenant-1",
    });
    assert.equal(result.status, "unavailable");
    assert.equal(result.traffic, null);
  });
});

function stubProvider(
  overrides: Partial<StorefrontAnalyticsProvider> = {},
): StorefrontAnalyticsProvider {
  return {
    ensureSite: async () => ({ siteId: "site-1" }),
    getDimensions: async ({ dimension }) => [
      { key: dimension === "device" ? "mobile" : "value", visits: 5 },
    ],
    getTimeSeries: async () => [{ date: "2026-09-01", pageViews: 10, visits: 8 }],
    getTrafficSummary: async () => ({
      bounceRate: 0.25,
      pageViews: 10,
      visitDurationSeconds: 42,
      visitors: 6,
      visits: 8,
    }),
    provisionSite: async () => ({ siteId: "site-1" }),
    trackEvent: async () => undefined,
    ...overrides,
  };
}
