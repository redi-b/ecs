import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { type ReconciliationJobState, reconcileQueuedJobs } from "./reconcile.js";
import { createJobRegistry, defineJob } from "./registry.js";
import type { JobRunRecord } from "./types.js";

const registry = createJobRegistry([
  defineJob({
    attempts: 4,
    backoff: { delayMs: 2_000, jitter: 0.2, type: "exponential" },
    idempotency: "required",
    manualRetry: "safe",
    name: "email.deliver",
    payloadSchema: z.object({ intentId: z.string() }),
    queue: "critical",
    retention: { completedSeconds: 60, failedSeconds: 60 },
    retry: "classified",
    timeoutMs: 1_000,
    version: 1,
  }),
]);

function run(overrides: Partial<JobRunRecord> = {}): JobRunRecord {
  const date = new Date("2026-09-12T00:00:00.000Z");
  return {
    attempts: 0,
    bullmqJobId: null,
    createdAt: date,
    error: "enqueue_failed:redis unavailable",
    finishedAt: null,
    id: "run_1",
    idempotencyKey: "email:1",
    maxAttempts: 4,
    name: "email.deliver",
    payload: { intentId: "intent_1" },
    queuedAt: date,
    result: null,
    startedAt: null,
    status: "queued",
    tenantId: "tenant_1",
    updatedAt: date,
    ...overrides,
  };
}

describe("queued job reconciliation", () => {
  it("recovers a missing BullMQ job once with its deterministic run id", async () => {
    const added: unknown[] = [];
    const errors: Array<string | null> = [];
    let state: ReconciliationJobState | "missing" = "missing";
    const queue = {
      async add(name: string, data: unknown, options: unknown) {
        added.push({ data, name, options });
        state = "waiting";
        return { id: "run_1" };
      },
      async inspect() {
        return { state };
      },
    };
    const store = {
      async listQueuedBefore() {
        return [run()];
      },
      async listActiveBefore() {
        return [];
      },
      async markCompleted() {},
      async markFailed() {},
      async markQueued() {},
      async recordError(_id: string, error: string | null) {
        errors.push(error);
      },
      async setBullmqJobId() {},
    };

    const first = await reconcileQueuedJobs({
      before: new Date(),
      limit: 10,
      queue,
      registry,
      store,
    });
    const second = await reconcileQueuedJobs({
      before: new Date(),
      limit: 10,
      queue,
      registry,
      store,
    });

    assert.equal(first.recovered, 1);
    assert.equal(second.present, 1);
    assert.equal(added.length, 1);
    assert.deepEqual(errors, [null]);
    assert.deepEqual(added[0], {
      data: { jobRunId: "run_1", payload: { intentId: "intent_1" }, tenantId: "tenant_1" },
      name: "email.deliver",
      options: {
        attempts: 4,
        backoff: { delay: 2_000, jitter: 0.2, type: "exponential" },
        jobId: "run_1",
        removeOnComplete: { age: 60 },
        removeOnFail: { age: 60 },
      },
    });
  });

  it("does not resurrect completed, failed, or unknown work", async () => {
    const errors: string[] = [];
    const queue = {
      async add() {
        throw new Error("must not enqueue");
      },
      async inspect() {
        return { state: "completed" as const };
      },
    };
    const store = {
      async listQueuedBefore() {
        return [run(), run({ id: "run_2", name: "removed.job" })];
      },
      async listActiveBefore() {
        return [];
      },
      async markCompleted() {},
      async markFailed() {},
      async markQueued() {},
      async recordError(_id: string, error: string | null) {
        if (error) errors.push(error);
      },
      async setBullmqJobId() {},
    };

    const summary = await reconcileQueuedJobs({
      before: new Date(),
      limit: 10,
      queue,
      registry,
      store,
    });
    assert.equal(summary.rejected, 2);
    assert.deepEqual(errors, ["job_state_conflict:completed", "job_definition_unknown"]);
  });
});

describe("stale active reconciliation", () => {
  it("repairs completed, failed, and retrying BullMQ states", async () => {
    const repaired: unknown[] = [];
    const snapshots = new Map([
      ["run_completed", { result: { sent: true }, state: "completed" as const }],
      ["run_failed", { failedReason: "provider timeout", state: "failed" as const }],
      ["run_retry", { state: "delayed" as const }],
    ]);
    const store = {
      async listActiveBefore() {
        return [
          run({ id: "run_completed", status: "active" }),
          run({ id: "run_failed", status: "active" }),
          run({ id: "run_retry", status: "active" }),
        ];
      },
      async listQueuedBefore() {
        return [];
      },
      async markCompleted(id: string, result: unknown) {
        repaired.push({ id, op: "completed", result });
      },
      async markFailed(id: string, error: string) {
        repaired.push({ error, id, op: "failed" });
      },
      async markQueued(id: string) {
        repaired.push({ id, op: "queued" });
      },
      async recordError() {},
      async setBullmqJobId() {},
    };
    const summary = await reconcileQueuedJobs({
      before: new Date(),
      limit: 10,
      queue: {
        async add() {
          throw new Error("must not enqueue");
        },
        async inspect(id) {
          return snapshots.get(id) ?? { state: "missing" as const };
        },
      },
      registry,
      store,
    });

    assert.equal(summary.repaired, 3);
    assert.deepEqual(repaired, [
      { id: "run_completed", op: "completed", result: { sent: true } },
      { error: "bullmq_failed:provider timeout", id: "run_failed", op: "failed" },
      { id: "run_retry", op: "queued" },
    ]);
  });

  it("terminally records an active run whose queue evidence vanished", async () => {
    const failures: string[] = [];
    const summary = await reconcileQueuedJobs({
      before: new Date(),
      limit: 10,
      queue: {
        async add() {
          throw new Error("must not enqueue");
        },
        async inspect() {
          return { state: "missing" as const };
        },
      },
      registry,
      store: {
        async listActiveBefore() {
          return [run({ status: "active" })];
        },
        async listQueuedBefore() {
          return [];
        },
        async markCompleted() {},
        async markFailed(_id, error) {
          failures.push(error);
        },
        async markQueued() {},
        async recordError() {},
        async setBullmqJobId() {},
      },
    });
    assert.equal(summary.rejected, 1);
    assert.deepEqual(failures, ["job_lost_after_active"]);
  });
});
