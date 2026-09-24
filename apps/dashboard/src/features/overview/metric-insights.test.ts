import assert from "node:assert/strict";
import test from "node:test";
import { metricIntervals, metricSplit } from "./metric-insights";

test("keeps missing days distinct from reported zero", () => {
  const result = metricIntervals(
    [{ date: "2026-09-01", orders: 0, revenue: 0 }],
    { start: "2026-09-01", end: "2026-09-03" },
    "revenue",
  );
  assert.deepEqual(
    result.map((row) => row.value),
    [0, null, null],
  );
});
test("groups consecutive days without inventing partial interval totals", () => {
  const rows = [1, 2, 3, 4].map((day) => ({
    date: `2026-09-0${day}`,
    orders: day,
    revenue: day * 10,
  }));
  const range = { start: "2026-09-04", end: "2026-09-01" };
  assert.deepEqual(
    metricIntervals(rows, range, "orders", 2).map((row) => row.value),
    [3, 7],
  );
  assert.deepEqual(
    metricIntervals(rows.slice(1), range, "orders", 2).map((row) => row.value),
    [null, 7],
  );
});
test("handles single days, empty inputs, invalid ranges and invalid values", () => {
  assert.deepEqual(metricIntervals([], null, "orders"), []);
  assert.deepEqual(metricIntervals([], { start: "bad", end: "bad" }, "orders"), []);
  assert.equal(
    metricIntervals(
      [{ date: "2026-09-01", orders: -1, revenue: 0 }],
      { start: "2026-09-01", end: "2026-09-01" },
      "orders",
    )[0]?.value,
    null,
  );
});
test("split requires a trustworthy denominator", () => {
  for (const pair of [
    [0, 0],
    [null, 2],
    [12, null],
    [12, 13],
    [12, -1],
    [12, 1.2],
  ] as const)
    assert.equal(metricSplit(pair[0], pair[1]), null);
  assert.deepEqual(metricSplit(12, 3), { subset: 3, rest: 9, share: 0.25 });
  assert.deepEqual(metricSplit(12, 0), { subset: 0, rest: 12, share: 0 });
  assert.deepEqual(metricSplit(12, 12), { subset: 12, rest: 0, share: 1 });
});

test("only a verified sparse reporting range can supply zero days", () => {
  const range = { start: "2026-09-01", end: "2026-09-03" };
  assert.deepEqual(
    metricIntervals([], range, "orders", 24, { start: "2026-09-02", end: "2026-09-03" }).map(
      (row) => row.value,
    ),
    [null, 0, 0],
  );
});
