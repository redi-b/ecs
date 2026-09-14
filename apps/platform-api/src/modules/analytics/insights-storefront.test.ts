import assert from "node:assert/strict";
import { it } from "node:test";
import { insightsStorefrontReportSchema } from "@ecs/contracts";
import { createInsightsStorefrontService } from "./insights-storefront.js";
const now = () => new Date("2026-09-14T08:00:00Z");
const query = { from: "2026-09-01", to: "2026-09-13" };
it("reports independent recorded reach, never manufactured funnel orders", async () => {
  const get = createInsightsStorefrontService(async (input) => {
    assert.equal(input.tenantId, "shop_1");
    assert.deepEqual(input.previousRange, { from: "2026-08-19", to: "2026-08-31" });
    return {
      stages: [
        { eventType: "storefront.page_viewed", sessions: 10, previousSessions: 8 },
        { eventType: "storefront.product_viewed", sessions: 12, previousSessions: 4 },
        { eventType: "order.created", sessions: 7, previousSessions: 5 },
      ],
      rows: [],
      count: 0,
      recordedEvents: 30,
      eventsWithoutSession: 3,
    };
  }, now);
  const result = await get({ tenantId: "shop_1", query });
  assert.ok(result.ok);
  assert.equal(result.report.stages[1]?.sessions, 12);
  assert.equal(result.report.stages.length, 5);
  assert.equal(result.report.eventsWithoutSession, 3);
  assert.ok(insightsStorefrontReportSchema.safeParse(result.report).success);
});
it("returns empty recorded counts and no previous counts with comparison disabled", async () => {
  const get = createInsightsStorefrontService(async (input) => {
    assert.equal(input.previousRange, null);
    return { stages: [], rows: [], count: 0, recordedEvents: 0, eventsWithoutSession: 0 };
  }, now);
  const result = await get({ tenantId: "shop_1", query: { ...query, comparison: "none" } });
  assert.ok(result.ok);
  assert.ok(
    result.report.stages.every((row) => row.sessions === 0 && row.previousSessions === null),
  );
});
it("rejects invalid bounds, stages, pagination and oversized searches before reading", async () => {
  const get = createInsightsStorefrontService(async () => {
    throw new Error("must not read");
  }, now);
  for (const override of [
    { to: "2026-09-14" },
    { from: "2020-01-01" },
    { stage: "orders" },
    { page: 10001 },
    { q: "x".repeat(121) },
    { trafficPage: 10001 },
    { trafficSearch: "x".repeat(121) },
    { trafficDimension: "customers" },
    { to: "2026-02-30" },
  ]) {
    assert.equal((await get({ tenantId: "shop_1", query: { ...query, ...override } })).ok, false);
  }
});
