import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateDashboardMetricRows,
  classifyDashboardMetricQuality,
} from "./dashboard-metrics-service.js";

describe("dashboard metric semantics", () => {
  it("keeps daily flows but uses only the latest snapshot for current-state metrics", () => {
    const result = aggregateDashboardMetricRows([
      row("2026-08-23", "overview.revenue", 100),
      row("2026-08-24", "overview.revenue", 250),
      row("2026-08-23", "overview.products", 4),
      row("2026-08-24", "overview.products", 5),
      row("2026-08-23", "overview.attention.unpaid", 3),
      row("2026-08-24", "overview.attention.unpaid", 2),
      row("2026-08-23", "overview.payment_status", 3, "status", "pending"),
      row("2026-08-24", "overview.payment_status", 2, "status", "pending"),
      row("2026-08-24", "overview.payment_status", 7, "status", "captured"),
    ]);

    assert.deepEqual(result.metrics.series, [
      { customers: 0, date: "2026-08-23", orders: 0, revenue: 100 },
      { customers: 0, date: "2026-08-24", orders: 0, revenue: 250 },
    ]);
    assert.equal(result.metrics.products, 5);
    assert.equal(result.metrics.attention.unpaidOrders, 2);
    assert.deepEqual(result.metrics.breakdowns.paymentStatus, [
      { count: 7, label: "captured" },
      { count: 2, label: "pending" },
    ]);
  });

  it("ignores unknown and non-numeric metric rows", () => {
    const result = aggregateDashboardMetricRows([
      row("2026-08-24", "unregistered.metric", 99),
      row("2026-08-24", "overview.products", "not-a-number"),
    ]);

    assert.equal(result.metrics.products, null);
    assert.deepEqual(result.metrics.series, []);
  });

  it("classifies never-run, fresh, and stale rollup checkpoints", () => {
    const now = new Date("2026-08-25T12:00:00.000Z");
    assert.equal(
      classifyDashboardMetricQuality(undefined, { now, staleAfterMs: 12 * 60 * 60 * 1000 }).status,
      "missing",
    );
    const checkpoint = {
      lastSuccessfulAt: new Date("2026-08-25T06:00:00.000Z"),
      rollupVersion: 1,
      timezone: "Africa/Addis_Ababa",
      watermark: new Date("2026-08-25T06:00:00.000Z"),
    };
    assert.equal(
      classifyDashboardMetricQuality(checkpoint, { now, staleAfterMs: 12 * 60 * 60 * 1000 }).status,
      "fresh",
    );
    assert.equal(
      classifyDashboardMetricQuality(
        { ...checkpoint, lastSuccessfulAt: new Date("2026-08-24T12:00:00.000Z") },
        { now, staleAfterMs: 12 * 60 * 60 * 1000 },
      ).status,
      "stale",
    );
  });
});

function row(
  date: string,
  metricKey: string,
  value: string | number,
  dimensionKey: string | null = null,
  dimensionValue: string | null = null,
) {
  return { date, dimensionKey, dimensionValue, metricKey, value };
}
