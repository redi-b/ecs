import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { insightsProductsReportSchema } from "@ecs/contracts";
import { createInsightsProductsService } from "./insights-products.js";

const now = new Date("2026-09-14T08:00:00Z");
const checkpoint = {
  lastSuccessfulAt: now,
  timezone: "Africa/Addis_Ababa",
  metadata: {
    currencyCode: "ETB",
    sourceWindowStart: "2026-06-15T21:00:00Z",
    sourceWindowEnd: now.toISOString(),
    productReportVersion: 1,
    missingItemOrders: 0,
    unassignedProductUnits: 0,
  },
};
const query = { from: "2026-09-01", to: "2026-09-13", comparison: "previous" };
const rows = [
  { productId: "p1", title: "Dress", thumbnail: null, units: 10, paidUnits: 5, previousUnits: 15 },
];
describe("Product contribution service", () => {
  it("scopes variant requests to one product and preserves variant identities", async () => {
    const get = createInsightsProductsService(
      async (input) => {
        assert.equal(input.tenantId, "shop_1");
        assert.equal(input.query.productId, "p1");
        assert.equal(input.query.page, 2);
        assert.equal(input.query.q, "Large");
        return {
          checkpoint,
          count: 21,
          rows: [{ ...rows[0]!, variantId: "v1", variantTitle: "Large / Blue" }],
        };
      },
      () => now,
    );
    const result = await get({
      tenantId: "shop_1",
      query: { ...query, productId: "p1", page: 2, q: "Large" },
    });
    assert.ok(result.ok);
    assert.equal(result.report.rows[0]?.variantId, "v1");
    assert.equal(result.report.rows[0]?.variantTitle, "Large / Blue");
    assert.equal(insightsProductsReportSchema.safeParse(result.report).success, true);
  });
  it("uses bounded paging and a validated shared comparison range", async () => {
    const get = createInsightsProductsService(
      async (input) => {
        assert.deepEqual(input.previousRange, { from: "2026-08-19", to: "2026-08-31" });
        assert.equal(input.query.page, 1);
        assert.equal(input.tenantId, "shop_1");
        return { checkpoint, count: 1, rows };
      },
      () => now,
    );
    const result = await get({ tenantId: "shop_1", query });
    assert.ok(result.ok);
    assert.equal(result.report.rows[0]?.change, -5);
    assert.equal(result.report.available, true);
    assert.equal(insightsProductsReportSchema.safeParse(result.report).success, true);
  });
  it("does not expose incomplete quantities as a complete product report", async () => {
    const get = createInsightsProductsService(
      async () => ({
        checkpoint: { ...checkpoint, metadata: { ...checkpoint.metadata, missingItemOrders: 1 } },
        count: 1,
        rows,
      }),
      () => now,
    );
    const result = await get({ tenantId: "shop_1", query });
    assert.ok(result.ok);
    assert.equal(result.report.available, false);
    assert.deepEqual(result.report.rows, []);
  });
  it("allows current quantities without manufacturing missing prior history", async () => {
    const get = createInsightsProductsService(
      async () => ({
        checkpoint: {
          ...checkpoint,
          metadata: { ...checkpoint.metadata, sourceWindowStart: "2026-08-31T21:00:00Z" },
        },
        count: 1,
        rows,
      }),
      () => now,
    );
    const result = await get({ tenantId: "shop_1", query });
    assert.ok(result.ok);
    assert.equal(result.report.available, true);
    assert.equal(result.report.comparisonAvailable, false);
    assert.equal(result.report.rows[0]?.previousUnits, null);
    assert.equal(result.report.rows[0]?.change, null);
  });
  it("rejects unbounded pagination, invalid dates, and oversized search strings", async () => {
    const get = createInsightsProductsService(
      async () => {
        throw new Error("must not read");
      },
      () => now,
    );
    for (const bad of [
      { ...query, page: 0 },
      { ...query, page: 10001 },
      { ...query, q: "x".repeat(121) },
      { ...query, from: "2026-02-30" },
      { ...query, productId: "" },
      { ...query, productId: "x".repeat(201) },
    ]) {
      assert.equal((await get({ tenantId: "shop_1", query: bad })).ok, false);
    }
  });
});
