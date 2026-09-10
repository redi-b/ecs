import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { StorefrontAnalyticsProvider } from "./providers/types.js";
import { createStorefrontAnalyticsBridge } from "./storefront-analytics-bridge.js";

describe("storefront analytics bridge", () => {
  it("provisions once and translates ECS events without passing customer data", async () => {
    const tracked: Parameters<StorefrontAnalyticsProvider["trackEvent"]>[0][] = [];
    let provisions = 0;
    const provider = stubProvider({
      ensureSite: async () => {
        provisions += 1;
        return { siteId: "site-1" };
      },
      trackEvent: async (input) => {
        tracked.push(input);
      },
    });
    const bridge = createStorefrontAnalyticsBridge({ provider });
    const event = {
      eventType: "storefront.product_viewed",
      hostname: "shop.example.com",
      properties: { customerId: "private", path: "/products/coffee", variantId: "var_1" },
      sessionId: "session-1",
      subjectId: "coffee",
      subjectType: "product",
      tenantId: "00000000-0000-4000-8000-000000000001",
      url: "/products/coffee",
    };

    await bridge.capture(event);
    await bridge.capture(event);

    assert.equal(provisions, 1);
    assert.equal(tracked.length, 2);
    assert.deepEqual(tracked[0]?.data, {
      subjectId: "coffee",
      subjectType: "product",
      variantId: "var_1",
    });
    assert.equal(tracked[0]?.eventName, "product-viewed");
  });

  it("does not surface provider failures to the storefront", async () => {
    const bridge = createStorefrontAnalyticsBridge({
      provider: stubProvider({
        ensureSite: async () => {
          throw new Error("offline");
        },
      }),
    });

    const result = await bridge.capture({
      eventType: "storefront.page_viewed",
      hostname: "shop.example.com",
      tenantId: "00000000-0000-4000-8000-000000000001",
      url: "/",
    });

    assert.deepEqual(result, { delivered: false });
  });
});

function stubProvider(
  overrides: Partial<StorefrontAnalyticsProvider>,
): StorefrontAnalyticsProvider {
  return {
    ensureSite: async () => ({ siteId: "site-1" }),
    getDimensions: async () => [],
    getTimeSeries: async () => [],
    getTrafficSummary: async () => ({
      bounceRate: null,
      pageViews: 0,
      visitDurationSeconds: null,
      visitors: 0,
      visits: 0,
    }),
    provisionSite: async () => ({ siteId: "site-1" }),
    trackEvent: async () => undefined,
    ...overrides,
  };
}
