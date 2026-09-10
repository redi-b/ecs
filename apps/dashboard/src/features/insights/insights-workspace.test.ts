import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateSalesSeries, selectPreviousSeries, selectRecentSeries } from "./insights-periods";

describe("Insights sales periods", () => {
  it("selects a calendar window from the latest available report day", () => {
    const series = [
      { date: "2026-05-01" },
      { date: "2026-06-01" },
      { date: "2026-06-29" },
      { date: "2026-06-30" },
    ];

    assert.deepEqual(selectRecentSeries(series, 30), series.slice(1));
    assert.deepEqual(selectRecentSeries(series, 90), series);
  });

  it("aligns the comparison window immediately before the selected period", () => {
    const series = Array.from({ length: 70 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    }));

    assert.deepEqual(selectPreviousSeries(series, 30), series.slice(10, 40));
    assert.deepEqual(selectRecentSeries(series, 30), series.slice(40));
  });

  it("groups long ranges into truthful calendar buckets", () => {
    assert.deepEqual(
      aggregateSalesSeries(
        [
          { date: "2026-06-01", orders: 1, revenue: 100 },
          { date: "2026-06-18", orders: 2, revenue: 300 },
          { date: "2026-07-02", orders: 1, revenue: 200 },
        ],
        "month",
      ),
      [
        { date: "2026-06-01", orders: 3, revenue: 400 },
        { date: "2026-07-01", orders: 1, revenue: 200 },
      ],
    );
  });
});
