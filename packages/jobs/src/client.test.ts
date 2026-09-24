import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { createPlatformDb, jobRuns } from "@ecs/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createJobsClient, enqueueWithQueue, type JobsQueueLike } from "./client.js";
import { DEFAULT_BACKOFF_MS, DEFAULT_MAX_ATTEMPTS } from "./defaults.js";
import { createJobRegistry, defineJob } from "./registry.js";
import { findJobRunById, insertJobRun } from "./runs.js";
import type { PlatformDb } from "./types.js";
import { startPlatformWorker } from "./worker.js";

const databaseUrl =
  process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5432/platform_db";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const dbHandle = createPlatformDb({ connectionString: databaseUrl });
const db: PlatformDb = dbHandle.db;

const createdIds: string[] = [];
type RecordedQueueCall = {
  name: Parameters<JobsQueueLike["add"]>[0];
  data: Parameters<JobsQueueLike["add"]>[1];
  opts: Parameters<JobsQueueLike["add"]>[2];
};

after(async () => {
  for (const id of createdIds) {
    await db.delete(jobRuns).where(eq(jobRuns.id, id));
  }
  await dbHandle.pool.end();
});

function trackId(id: string): string {
  createdIds.push(id);
  return id;
}

function createRecordingQueue(options?: {
  throwOnAdd?: Error;
  idFromJobRun?: boolean;
}): JobsQueueLike & {
  calls: RecordedQueueCall[];
} {
  const calls: RecordedQueueCall[] = [];

  return {
    calls,
    async add(name, data, opts) {
      calls.push({ name, data, opts });
      if (options?.throwOnAdd) {
        throw options.throwOnAdd;
      }
      return { id: options?.idFromJobRun === false ? "custom-bull-id" : data.jobRunId };
    },
  };
}

describe("enqueueWithQueue validation", () => {
  it("throws on empty name before touching the queue", async () => {
    const queue = createRecordingQueue();
    await assert.rejects(
      () =>
        enqueueWithQueue({
          db,
          queue,
          input: { name: "" },
        }),
      /Job name must be non-empty/,
    );
    assert.equal(queue.calls.length, 0);
  });

  it("throws on whitespace-only name", async () => {
    const queue = createRecordingQueue();
    await assert.rejects(
      () =>
        enqueueWithQueue({
          db,
          queue,
          input: { name: "   " },
        }),
      /Job name must be non-empty/,
    );
    assert.equal(queue.calls.length, 0);
  });
});

describe("enqueueWithQueue", () => {
  it("inserts a queued run, adds to BullMQ, and sets bullmq job id", async () => {
    const queue = createRecordingQueue();
    const result = await enqueueWithQueue({
      db,
      queue,
      input: {
        name: "  test.client.enqueue  ",
        payload: { hello: "world" },
        maxAttempts: 5,
      },
    });

    trackId(result.jobRunId);
    assert.equal(result.reused, false);
    assert.equal(result.status, "queued");
    assert.equal(result.name, "test.client.enqueue");

    assert.equal(queue.calls.length, 1);
    const call = queue.calls[0]!;
    assert.equal(call.name, "test.client.enqueue");
    assert.equal(call.data.jobRunId, result.jobRunId);
    assert.deepEqual(call.data.payload, { hello: "world" });
    assert.equal(call.opts.jobId, result.jobRunId);
    assert.equal(call.opts.attempts, 5);
    assert.deepEqual(call.opts.backoff, {
      type: "exponential",
      delay: DEFAULT_BACKOFF_MS,
    });

    const record = await findJobRunById(db, result.jobRunId);
    assert.ok(record);
    assert.equal(record.status, "queued");
    assert.equal(record.bullmqJobId, result.jobRunId);
    assert.equal(record.maxAttempts, 5);
  });

  it("uses DEFAULT_MAX_ATTEMPTS when maxAttempts is omitted", async () => {
    const queue = createRecordingQueue();
    const result = await enqueueWithQueue({
      db,
      queue,
      input: { name: "test.client.default-attempts" },
    });
    trackId(result.jobRunId);

    assert.equal(queue.calls[0]?.opts.attempts, DEFAULT_MAX_ATTEMPTS);
  });

  it("reuses any existing run for the same idempotency key", async () => {
    const existing = await insertJobRun(db, {
      name: "test.client.idempotent",
      idempotencyKey: "idem-client-1",
      payload: { n: 1 },
    });
    trackId(existing.id);

    // Simulate a terminal status so we prove reuse is not limited to queued.
    await db.update(jobRuns).set({ status: "completed" }).where(eq(jobRuns.id, existing.id));

    const queue = createRecordingQueue();
    const result = await enqueueWithQueue({
      db,
      queue,
      input: {
        name: "test.client.idempotent",
        idempotencyKey: "idem-client-1",
        payload: { n: 2 },
      },
    });

    assert.equal(result.reused, true);
    assert.equal(result.jobRunId, existing.id);
    assert.equal(result.status, "completed");
    assert.equal(queue.calls.length, 0);
  });

  it("keeps durable queued intent and rethrows when queue.add fails", async () => {
    const boom = new Error("redis unavailable");
    const queue = createRecordingQueue({ throwOnAdd: boom });

    await assert.rejects(
      () =>
        enqueueWithQueue({
          db,
          queue,
          input: { name: "test.client.queue-fail" },
        }),
      (err: unknown) => {
        assert.equal(err, boom);
        return true;
      },
    );

    // PostgreSQL intent survives Redis failure so reconciliation can recover it.
    const rows = await db.select().from(jobRuns).where(eq(jobRuns.name, "test.client.queue-fail"));

    assert.ok(rows.length >= 1);
    const pending = rows[rows.length - 1]!;
    trackId(pending.id);
    assert.equal(pending.status, "queued");
    assert.equal(pending.error, "enqueue_failed:redis unavailable");
    assert.equal(pending.finishedAt, null);
  });
});

describe("createJobsClient", () => {
  it("getJobRun returns null for unknown ids", async () => {
    const client = createJobsClient({
      redisUrl,
      db,
      queueName: "platform-jobs-client-test",
      prefix: "ecs-test",
    });

    try {
      const missing = await client.getJobRun("00000000-0000-4000-8000-000000000099");
      assert.equal(missing, null);
    } finally {
      await client.close();
    }
  });

  it("enqueueJob + getJobRun round-trip against real Redis", async () => {
    const client = createJobsClient({
      redisUrl,
      db,
      queueName: "platform-jobs-client-test",
      prefix: "ecs-test",
    });

    try {
      const enqueued = await client.enqueueJob({
        name: "test.client.live-redis",
        payload: { live: true },
      });
      trackId(enqueued.jobRunId);

      assert.equal(enqueued.reused, false);
      assert.equal(enqueued.status, "queued");

      const record = await client.getJobRun(enqueued.jobRunId);
      assert.ok(record);
      assert.equal(record.id, enqueued.jobRunId);
      assert.equal(record.name, "test.client.live-redis");
      assert.equal(record.status, "queued");
      assert.equal(record.bullmqJobId, enqueued.jobRunId);
      assert.deepEqual(record.payload, { live: true });
    } finally {
      await client.close();
    }
  });

  it("exposes sanitized operational summaries and preserves failed history on retry", async () => {
    const registry = createJobRegistry([
      defineJob({
        attempts: 2,
        backoff: { delayMs: 10, jitter: 0, type: "fixed" },
        idempotency: "required",
        manualRetry: "safe",
        name: "test.client.control",
        payloadSchema: z.object({ secret: z.string() }),
        queue: "default",
        retention: { completedSeconds: 60, failedSeconds: 60 },
        retry: "classified",
        timeoutMs: 1_000,
        version: 1,
      }),
    ]);
    const client = createJobsClient({
      redisUrl,
      db,
      queueName: `platform-jobs-control-${crypto.randomUUID()}`,
      prefix: "ecs-test",
      registry,
    });

    try {
      assert.equal(await client.getSchedulerHealth(), null);
      await client.recordSchedulerHeartbeat({ buildVersion: "test-build", ttlMs: 5_000 });
      const scheduler = await client.getSchedulerHealth();
      assert.equal(scheduler?.buildVersion, "test-build");
      assert.ok(scheduler?.lastSeenAt instanceof Date);

      const failed = await insertJobRun(db, {
        idempotencyKey: `failed-${crypto.randomUUID()}`,
        name: "test.client.control",
        payload: { secret: "must-not-leak" },
      });
      trackId(failed.id);
      await db
        .update(jobRuns)
        .set({ error: "provider_error:customer@example.com", status: "failed" })
        .where(eq(jobRuns.id, failed.id));

      const summaries = await client.listOperationalJobs();
      const summary = summaries.find((item) => item.id === failed.id);
      assert.ok(summary);
      assert.equal(summary.canRetry, true);
      assert.equal(summary.errorCode, "provider_error");
      assert.equal("payload" in summary, false);
      assert.equal("result" in summary, false);
      assert.equal("idempotencyKey" in summary, false);

      const retried = await client.retryFailedJob(failed.id);
      assert.equal(retried.ok, true);
      if (!retried.ok) return;
      trackId(retried.run.id);
      assert.notEqual(retried.run.id, failed.id);
      assert.equal(retried.run.status, "queued");
      assert.equal((await client.getJobRun(failed.id))?.status, "failed");
    } finally {
      await client.close();
    }
  });

  it("cancels a waiting run but refuses a run whose durable state changed", async () => {
    const registry = createJobRegistry([
      defineJob({
        attempts: 1,
        backoff: { delayMs: 0, jitter: 0, type: "fixed" },
        idempotency: "optional",
        manualRetry: "never",
        name: "test.client.cancel",
        payloadSchema: z.object({}),
        queue: "bulk",
        retention: { completedSeconds: 60, failedSeconds: 60 },
        retry: "never",
        timeoutMs: 1_000,
        version: 1,
      }),
    ]);
    const client = createJobsClient({
      redisUrl,
      db,
      queueName: `platform-jobs-cancel-${crypto.randomUUID()}`,
      prefix: "ecs-test",
      registry,
    });

    try {
      const queued = await client.enqueueJob({ name: "test.client.cancel", payload: {} });
      trackId(queued.jobRunId);
      const cancelled = await client.cancelQueuedJob(queued.jobRunId);
      assert.equal(cancelled.ok, true);
      assert.equal((await client.getJobRun(queued.jobRunId))?.status, "cancelled");
      const refused = await client.cancelQueuedJob(queued.jobRunId);
      assert.deepEqual(refused, { error: "job_not_cancellable", ok: false });
    } finally {
      await client.close();
    }
  });

  it("keeps critical work responsive while bulk capacity is occupied", async () => {
    const registry = createJobRegistry([
      defineJob({
        attempts: 1,
        backoff: { delayMs: 0, jitter: 0, type: "fixed" },
        idempotency: "required",
        manualRetry: "never",
        name: "test.acceptance.critical",
        payloadSchema: z.object({ key: z.string() }),
        queue: "critical",
        retention: { completedSeconds: 60, failedSeconds: 60 },
        retry: "never",
        timeoutMs: 5_000,
        version: 1,
      }),
      defineJob({
        attempts: 1,
        backoff: { delayMs: 0, jitter: 0, type: "fixed" },
        idempotency: "required",
        manualRetry: "never",
        name: "test.acceptance.bulk",
        payloadSchema: z.object({ key: z.string() }),
        queue: "bulk",
        retention: { completedSeconds: 60, failedSeconds: 60 },
        retry: "never",
        timeoutMs: 5_000,
        version: 1,
      }),
    ]);
    const queueName = `platform-jobs-isolation-${crypto.randomUUID()}`;
    let releaseBulk = () => {};
    const bulkGate = new Promise<void>((resolve) => { releaseBulk = resolve; });
    let bulkStarted = false;
    const shared = { db, heartbeatMs: 1_000, prefix: "ecs-test", redisUrl, registry };
    const bulkWorker = startPlatformWorker({
      ...shared,
      concurrency: 1,
      handlers: { "test.acceptance.bulk": async () => { bulkStarted = true; await bulkGate; } },
      queueName: `${queueName}-bulk`,
    });
    const criticalWorker = startPlatformWorker({
      ...shared,
      concurrency: 1,
      handlers: { "test.acceptance.critical": async () => ({ done: true }) },
      queueName: `${queueName}-critical`,
    });
    const client = createJobsClient({ ...shared, queueName });

    try {
      const bulk = await client.enqueueJob({
        idempotencyKey: `bulk-${crypto.randomUUID()}`,
        name: "test.acceptance.bulk",
        payload: { key: "bulk" },
      });
      trackId(bulk.jobRunId);
      await waitUntil(() => bulkStarted);
      const critical = await client.enqueueJob({
        idempotencyKey: `critical-${crypto.randomUUID()}`,
        name: "test.acceptance.critical",
        payload: { key: "critical" },
      });
      trackId(critical.jobRunId);
      await waitUntil(async () => (await client.getJobRun(critical.jobRunId))?.status === "completed");
      assert.equal((await client.getJobRun(bulk.jobRunId))?.status, "active");
    } finally {
      releaseBulk();
      await Promise.all([bulkWorker.close(), criticalWorker.close(), client.close()]);
    }
  });

  it("converges concurrent producers on one idempotent run", async () => {
    const registry = createJobRegistry([
      defineJob({
        attempts: 1,
        backoff: { delayMs: 0, jitter: 0, type: "fixed" },
        idempotency: "required",
        manualRetry: "never",
        name: "test.acceptance.idempotent",
        payloadSchema: z.object({ key: z.string() }),
        queue: "critical",
        retention: { completedSeconds: 60, failedSeconds: 60 },
        retry: "never",
        timeoutMs: 1_000,
        version: 1,
      }),
    ]);
    const client = createJobsClient({
      db,
      prefix: "ecs-test",
      queueName: `platform-jobs-idempotency-${crypto.randomUUID()}`,
      redisUrl,
      registry,
    });
    const idempotencyKey = `shared-${crypto.randomUUID()}`;
    try {
      const runs = await Promise.all(
        Array.from({ length: 8 }, () =>
          client.enqueueJob({
            idempotencyKey,
            name: "test.acceptance.idempotent",
            payload: { key: "same-work" },
          }),
        ),
      );
      const ids = new Set(runs.map((run) => run.jobRunId));
      assert.equal(ids.size, 1);
      trackId(runs[0]!.jobRunId);
    } finally {
      await client.close();
    }
  });
});

async function waitUntil(check: () => boolean | Promise<boolean>, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for acceptance condition");
}
