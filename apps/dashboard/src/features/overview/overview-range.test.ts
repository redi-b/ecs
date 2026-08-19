import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterSeriesByRange, getPresetRange } from "./overview-range.js";

const rows = Array.from({ length: 90 }, (_, index) => {
  const date = new Date("2026-05-01T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + index);
  return { date: date.toISOString().slice(0, 10), value: index };
});

describe("overview chart ranges", () => {
  it("selects the latest seven days from the available series", () => {
    const range = getPresetRange(rows, "7d");
    assert.ok(range);
    const result = filterSeriesByRange(rows, range);
    assert.equal(result.length, 7);
    assert.equal(result.at(-1)?.date, rows.at(-1)?.date);
  });

  it("normalizes a reversed custom date range", () => {
    const result = filterSeriesByRange(rows, { start: "2026-05-12", end: "2026-05-10" });
    assert.deepEqual(result.map((row) => row.date), [
      "2026-05-10",
      "2026-05-11",
      "2026-05-12",
    ]);
  });
});
