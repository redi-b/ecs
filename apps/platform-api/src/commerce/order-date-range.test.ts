import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCreatedRange } from "../adapters/medusa/order/list-query.js";

test("today starts at Ethiopian midnight, including before UTC midnight", () => {
  assert.deepEqual(resolveCreatedRange({ created: "today" }, new Date("2026-09-05T22:00:00Z")), {
    createdFrom: "2026-09-05T21:00:00.000Z",
    createdTo: "2026-09-05T22:00:00.000Z",
  });
});

test("last seven days includes today and the preceding six calendar days", () => {
  assert.deepEqual(
    resolveCreatedRange({ created: "last_7_days" }, new Date("2026-03-02T10:00:00Z")),
    {
      createdFrom: "2026-02-23T21:00:00.000Z",
      createdTo: "2026-03-02T10:00:00.000Z",
    },
  );
});

test("explicit timestamp bounds retain API compatibility and override presets", () => {
  const bounds = { createdFrom: "2026-08-31T21:00:00Z", createdTo: "2026-09-01T20:59:59.999Z" };
  assert.deepEqual(resolveCreatedRange({ ...bounds, created: "today" }), bounds);
  assert.deepEqual(resolveCreatedRange({}), {});
});

test("thirty calendar days cross the year boundary", () => {
  assert.deepEqual(
    resolveCreatedRange({ created: "last_30_days" }, new Date("2026-01-05T12:00:00Z")),
    {
      createdFrom: "2025-12-06T21:00:00.000Z",
      createdTo: "2026-01-05T12:00:00.000Z",
    },
  );
});

test("calendar presets include leap day", () => {
  assert.deepEqual(
    resolveCreatedRange({ created: "last_7_days" }, new Date("2024-03-01T09:00:00Z")),
    {
      createdFrom: "2024-02-23T21:00:00.000Z",
      createdTo: "2024-03-01T09:00:00.000Z",
    },
  );
});

test("today rolls over exactly at Ethiopian midnight", () => {
  assert.equal(
    resolveCreatedRange({ created: "today" }, new Date("2026-09-05T20:59:59.999Z")).createdFrom,
    "2026-09-04T21:00:00.000Z",
  );
  assert.equal(
    resolveCreatedRange({ created: "today" }, new Date("2026-09-05T21:00:00.000Z")).createdFrom,
    "2026-09-05T21:00:00.000Z",
  );
});

test("one-sided explicit bounds do not acquire an implicit preset boundary", () => {
  assert.deepEqual(resolveCreatedRange({ created: "today", createdFrom: "2026-08-31T21:00:00Z" }), {
    createdFrom: "2026-08-31T21:00:00Z",
  });
  assert.deepEqual(
    resolveCreatedRange({ created: "today", createdTo: "2026-09-01T20:59:59.999Z" }),
    {
      createdTo: "2026-09-01T20:59:59.999Z",
    },
  );
});
