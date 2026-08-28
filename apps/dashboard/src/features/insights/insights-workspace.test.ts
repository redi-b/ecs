import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { selectRecentSeries } from "./insights-workspace";

describe("Insights sales periods", () => {
  it("selects a calendar window from the latest available report day", () => {
    const series = [
      { date: "2026-05-01" },
      { date: "2026-06-01" },
      { date: "2026-06-29" },
      { date: "2026-06-30" },
    ];

    assert.deepEqual(selectRecentSeries(series, 30), series.slice(2));
    assert.deepEqual(selectRecentSeries(series, 90), series);
  });
});
