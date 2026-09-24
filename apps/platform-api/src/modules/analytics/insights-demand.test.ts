import assert from "node:assert/strict";
import test from "node:test";
import { insightsDemandReportSchema } from "@ecs/contracts";
import { createInsightsDemandService, type ReadProductDemand } from "./insights-demand.js";

const now = () => new Date("2026-09-14T08:00:00Z");
const query = { from: "2026-09-01", to: "2026-09-13" };
const source: Awaited<ReturnType<ReadProductDemand>> = {
  checkpoint: {
    lastSuccessfulAt: now(),
    timezone: "Africa/Addis_Ababa",
    metadata: {
      currencyCode: "ETB",
      sourceWindowStart: "2026-08-01T21:00:00Z",
      sourceWindowEnd: now().toISOString(),
      productReportVersion: 1,
      missingItemOrders: 0,
      unassignedProductUnits: 0,
    },
  },
  count: 2,
  tracking: { recordedEvents: 8, unlinkedEvents: 3, eventsWithoutSession: 1 },
  rows: [
    {
      key: "product:p1",
      productId: "p1",
      identity: "product",
      title: "Shirt",
      thumbnail: null,
      views: 2,
      cartSessions: 3,
      units: 7,
      paidUnits: 4,
    },
    {
      key: "product:shirt:legacy",
      productId: null,
      identity: "legacy_handle",
      title: "shirt",
      thumbnail: null,
      views: 3,
      cartSessions: 0,
      units: null,
      paidUnits: null,
    },
  ],
};

test("keeps legacy activity visible without assigning invented sales or conversion rates", async () => {
  const result = await createInsightsDemandService(async (input) => {
    assert.equal(input.tenantId, "shop_1");
    return source;
  }, now)({ tenantId: "shop_1", query });
  assert.ok(result.ok);
  assert.ok(insightsDemandReportSchema.safeParse(result.report).success);
  assert.equal(result.report.salesAvailable, true);
  assert.equal(result.report.rows[0]?.units, 7);
  assert.equal(result.report.rows[0]?.cartSessions, 3); // independent reach, not funnel-clamped
  assert.equal(result.report.rows[1]?.units, null);
  assert.equal(result.report.tracking.unlinkedEvents, 3);
});

test("retains interest while withholding sales outside verified coverage", async () => {
  const result = await createInsightsDemandService(
    async () => ({ ...source, checkpoint: null }),
    now,
  )({ tenantId: "shop_1", query });
  assert.ok(result.ok);
  assert.equal(result.report.salesAvailable, false);
  assert.equal(result.report.rows[0]?.views, 2);
  assert.equal(result.report.rows[0]?.units, null);
});

test("rejects invalid demand ranges and controls before reading", async () => {
  const get = createInsightsDemandService(async () => {
    throw new Error("must not read");
  }, now);
  for (const override of [
    { from: "2020-01-01" },
    { to: "2026-09-14" },
    { page: 10001 },
    { q: "x".repeat(121) },
    { sort: "conversion" },
  ]) {
    assert.equal((await get({ tenantId: "shop_1", query: { ...query, ...override } })).ok, false);
  }
});
