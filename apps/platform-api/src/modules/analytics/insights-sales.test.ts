import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { insightsSalesReportSchema } from "@ecs/contracts";
import {
  buildSalesReport,
  createInsightsSalesService,
  type SalesSource,
} from "./insights-sales.js";
import {
  completeReportingCoverage,
  reportingDay,
  reportingDayStart,
} from "./reporting-calendar.js";

const now = new Date("2026-09-14T08:00:00Z");
const source: SalesSource = {
  checkpoint: {
    lastSuccessfulAt: now,
    timezone: "Africa/Addis_Ababa",
    metadata: {
      currencyCode: "ETB",
      sourceWindowStart: "2026-06-15T21:00:00Z",
      sourceWindowEnd: now.toISOString(),
    },
  },
  rows: [
    { date: "2026-09-12", metricKey: "overview.orders", value: "2" },
    { date: "2026-09-12", metricKey: "overview.revenue", value: "1234.5" },
    { date: "2026-09-09", metricKey: "overview.orders", value: "1" },
  ],
};
const query = { from: "2026-09-11", to: "2026-09-13", comparison: "previous" as const };

describe("Insights Sales foundation", () => {
  it("anchors comparisons to the requested calendar, not observed sale dates", () => {
    const result = buildSalesReport({ now, query, source, tenantId: "shop_1" });
    assert.deepEqual(result.previousRange, { from: "2026-09-08", to: "2026-09-10" });
    assert.deepEqual(result.totals, { orders: 2, paidOrderValue: 1234.5 });
    assert.deepEqual(result.previousTotals, { orders: 1, paidOrderValue: 0 });
    assert.deepEqual(
      result.series.map((p) => p.orders),
      [0, 2, 0],
    );
    assert.deepEqual(
      result.series.map((p) => p.previousOrders),
      [0, 1, 0],
    );
    assert.equal(insightsSalesReportSchema.safeParse(result).success, true);
  });
  it("leaves unverified history missing, even when old rows exist", () => {
    const result = buildSalesReport({
      now,
      query,
      source: { ...source, checkpoint: null },
      tenantId: "shop_1",
    });
    assert.equal(result.totals, null);
    assert.equal(result.previousTotals, null);
    assert.equal(result.quality.status, "missing");
    assert.ok(result.series.every((p) => p.orders === null));
  });
  it("does not infer zeros from a legacy checkpoint without a source window", () => {
    const result = buildSalesReport({
      now,
      query,
      source: {
        ...source,
        checkpoint: { ...source.checkpoint!, metadata: { currencyCode: "ETB" } },
      },
      tenantId: "shop_1",
    });
    assert.equal(result.totals, null);
  });
  it("recognizes a successfully scanned empty shop as zero", () => {
    const result = buildSalesReport({
      now,
      query,
      source: { ...source, rows: [] },
      tenantId: "shop_1",
    });
    assert.deepEqual(result.totals, { orders: 0, paidOrderValue: 0 });
  });
  it("withholds totals and comparison for partially covered periods", () => {
    const result = buildSalesReport({
      now,
      query: { ...query, from: "2026-06-15", to: "2026-06-17" },
      source,
      tenantId: "shop_1",
    });
    assert.deepEqual(
      result.series.map((p) => p.orders),
      [null, 0, 0],
    );
    assert.equal(result.totals, null);
    assert.equal(result.previousTotals, null);
  });
  it("does not sum non-finite or corrupt values into a report", () => {
    const result = buildSalesReport({
      now,
      query,
      source: {
        ...source,
        rows: [{ date: query.from, metricKey: "overview.orders", value: "NaN" }],
      },
      tenantId: "shop_1",
    });
    assert.equal(result.totals, null);
  });
  it("returns bounded reads and validates ranges before reading any data", async () => {
    const reads: unknown[] = [];
    const get = createInsightsSalesService(
      async (input) => {
        reads.push(input);
        return source;
      },
      () => now,
    );
    for (const bad of [
      { ...query, from: "2026-02-30" },
      { ...query, from: "2026-09-14" },
      { ...query, to: "2026-09-14" },
      { ...query, from: "2024-01-01" },
      { ...query, comparison: "other" },
      { ...query, extra: "ignored?" },
      { ...query, from: "0000-01-01", to: "0000-01-02" },
    ])
      assert.equal((await get({ tenantId: "shop_1", query: bad })).ok, false);
    assert.equal(reads.length, 0);
    assert.equal((await get({ tenantId: "shop_1", query })).ok, true);
    assert.deepEqual(reads, [{ tenantId: "shop_1", from: "2026-09-08", to: "2026-09-13" }]);
  });
  it("can disable comparison without fetching a second period", async () => {
    const get = createInsightsSalesService(
      async (input) => {
        assert.equal(input.from, query.from);
        return source;
      },
      () => now,
    );
    const result = await get({ tenantId: "shop_1", query: { ...query, comparison: "none" } });
    assert.ok(result.ok);
    assert.equal(result.report.previousRange, null);
    assert.equal(result.report.previousTotals, null);
  });
  it("marks old successful reports stale without replacing their values with zero", () => {
    const result = buildSalesReport({
      now: new Date("2026-09-15T09:00:00Z"),
      query,
      source,
      tenantId: "shop_1",
    });
    assert.equal(result.quality.status, "stale");
    assert.equal(result.totals?.orders, 2);
  });
});

describe("Ethiopian reporting calendar", () => {
  it("crosses midnight independently of server timezone", () => {
    assert.equal(reportingDay(new Date("2026-09-13T21:00:00Z")), "2026-09-14");
    assert.equal(reportingDayStart("2026-09-14").toISOString(), "2026-09-13T21:00:00.000Z");
  });
  it("only certifies complete calendar days", () => {
    assert.deepEqual(
      completeReportingCoverage(new Date("2026-09-01T10:00:00Z"), new Date("2026-09-04T10:00:00Z")),
      { from: "2026-09-02", to: "2026-09-03" },
    );
    assert.equal(
      completeReportingCoverage(new Date("2026-09-01T10:00:00Z"), new Date("2026-09-01T11:00:00Z")),
      null,
    );
  });
});
