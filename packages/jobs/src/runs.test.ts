import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { JobRunRow } from "./runs.js";
import { serializeJobRun, shouldReuseExistingRun } from "./runs.js";
import type { JobRunStatus } from "./types.js";

const ALL_STATUSES: JobRunStatus[] = [
  "queued",
  "active",
  "completed",
  "failed",
  "cancelled",
];

describe("shouldReuseExistingRun", () => {
  for (const status of ALL_STATUSES) {
    it(`returns true for ${status}`, () => {
      assert.equal(shouldReuseExistingRun(status), true);
    });
  }
});

describe("serializeJobRun", () => {
  it("maps drizzle row fields to JobRunRecord", () => {
    const queuedAt = new Date("2026-01-01T00:00:00.000Z");
    const startedAt = new Date("2026-01-01T00:01:00.000Z");
    const finishedAt = new Date("2026-01-01T00:02:00.000Z");
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-01T00:02:00.000Z");

    const row = {
      id: "11111111-1111-1111-1111-111111111111",
      tenantId: "22222222-2222-2222-2222-222222222222",
      name: "example.job",
      status: "completed" as const,
      payload: { foo: "bar" },
      result: { ok: true },
      error: null,
      attempts: 1,
      maxAttempts: 3,
      idempotencyKey: "idem-1",
      bullmqJobId: "bull-1",
      queuedAt,
      startedAt,
      finishedAt,
      createdAt,
      updatedAt,
    } satisfies JobRunRow;

    assert.deepEqual(serializeJobRun(row), {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      status: "completed",
      payload: { foo: "bar" },
      result: { ok: true },
      error: null,
      attempts: 1,
      maxAttempts: 3,
      idempotencyKey: "idem-1",
      bullmqJobId: "bull-1",
      queuedAt,
      startedAt,
      finishedAt,
      createdAt,
      updatedAt,
    });
  });

  it("normalizes nullable fields to null", () => {
    const queuedAt = new Date("2026-01-02T00:00:00.000Z");
    const createdAt = new Date("2026-01-02T00:00:00.000Z");
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");

    const row = {
      id: "33333333-3333-3333-3333-333333333333",
      tenantId: null,
      name: "example.job",
      status: "queued" as const,
      payload: {},
      result: null,
      error: null,
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: null,
      bullmqJobId: null,
      queuedAt,
      startedAt: null,
      finishedAt: null,
      createdAt,
      updatedAt,
    } satisfies JobRunRow;

    const record = serializeJobRun(row);

    assert.equal(record.tenantId, null);
    assert.equal(record.result, null);
    assert.equal(record.error, null);
    assert.equal(record.idempotencyKey, null);
    assert.equal(record.bullmqJobId, null);
    assert.equal(record.startedAt, null);
    assert.equal(record.finishedAt, null);
    assert.equal(record.status, "queued");
    assert.deepEqual(record.payload, {});
  });
});
