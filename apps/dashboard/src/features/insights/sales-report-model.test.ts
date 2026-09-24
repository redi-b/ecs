import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InsightsSalesReport } from "@ecs/contracts";
import {
  defaultSalesRange,
  reportCsv,
  salesBuckets,
  salesChange,
  shiftSalesDay,
} from "./sales-report-model";

const report: InsightsSalesReport = {
  tenantId: "shop_1",
  generatedAt: "2026-09-14T08:00:00Z",
  currencyCode: "ETB",
  timezone: "Africa/Addis_Ababa",
  range: { from: "2026-09-06", to: "2026-09-13" },
  previousRange: { from: "2026-08-29", to: "2026-09-05" },
  quality: {
    status: "fresh",
    updatedAt: "2026-09-14T08:00:00Z",
    coverage: { from: "2026-08-01", to: "2026-09-13" },
  },
  totals: { orders: 8, paidOrderValue: 80 },
  previousTotals: { orders: 16, paidOrderValue: 160 },
  series: Array.from({ length: 8 }, (_, i) => ({
    date: shiftSalesDay("2026-09-06", i),
    orders: 1,
    paidOrderValue: 10,
    previousDate: shiftSalesDay("2026-08-29", i),
    previousOrders: 2,
    previousPaidOrderValue: 20,
  })),
};

describe("Sales report presentation", () => {
  it("anchors the default window to yesterday in Ethiopia", () => {
    assert.deepEqual(defaultSalesRange(new Date("2026-09-13T21:01:00Z")), {
      from: "2026-08-15",
      to: "2026-09-13",
    });
    assert.deepEqual(defaultSalesRange(new Date("2026-09-13T20:59:00Z")), {
      from: "2026-08-14",
      to: "2026-09-12",
    });
  });
  it("keeps partial final groups equal in length between periods", () => {
    assert.deepEqual(salesBuckets(report, "orders", "week"), [
      {
        from: "2026-09-06",
        to: "2026-09-12",
        previousFrom: "2026-08-29",
        previousTo: "2026-09-04",
        current: 7,
        previous: 14,
      },
      {
        from: "2026-09-13",
        to: "2026-09-13",
        previousFrom: "2026-09-05",
        previousTo: "2026-09-05",
        current: 1,
        previous: 2,
      },
    ]);
  });
  it("does not interpolate or sum across missing observations", () => {
    const partial = {
      ...report,
      series: report.series.map((p, i) => (i === 2 ? { ...p, orders: null } : p)),
    };
    const buckets = salesBuckets(partial, "orders", "week");
    assert.equal(buckets[0]?.current, null);
    assert.equal(buckets[0]?.previous, 14);
    assert.equal(buckets[1]?.current, 1);
  });
  it("distinguishes zero baseline from missing comparison", () => {
    assert.deepEqual(salesChange(10, 0), { amount: 10, percent: null });
    assert.equal(salesChange(10, null), null);
    assert.deepEqual(salesChange(0, 10), { amount: -10, percent: -100 });
  });
  it("exports every day and leaves missing values blank, not zero", () => {
    const csv = reportCsv({
      ...report,
      series: [{ ...report.series[0]!, orders: null, previousOrders: 0 }],
    });
    assert.match(csv, /2026-09-06,Africa\/Addis_Ababa,ETB,,10,2026-08-29,0,20/);
    assert.equal(reportCsv(report).split("\r\n").length, 9);
  });
});
