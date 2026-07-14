import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { createPlatformDb, jobRuns } from "@ecs/db";
import { eq } from "drizzle-orm";

import {
  createJobsClient,
  enqueueWithQueue,
  type JobsQueueLike,
} from "./client.js";
import { DEFAULT_BACKOFF_MS, DEFAULT_MAX_ATTEMPTS } from "./defaults.js";
import { findJobRunById, insertJobRun } from "./runs.js";
import type { PlatformDb } from "./types.js";

const databaseUrl =
  process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5432/platform_db";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const dbHandle = createPlatformDb({ connectionString: databaseUrl });
const db: PlatformDb = dbHandle.db;

const createdIds: string[] = [];

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
  calls: Array<{
    name: string;
    data: { jobRunId: string; tenantId: string | null; payload: unknown };
    opts: {
      jobId: string;
      attempts: number;
      backoff: { type: "exponential"; delay: number };
    };
  }>;
} {
  const calls: Array<{
    name: string;
    data: { jobRunId: string; tenantId: string | null; payload: unknown };
    opts: {
      jobId: string;
      attempts: number;
      backoff: { type: "exponential"; delay: number };
    };
  }> = [];

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
    await db
      .update(jobRuns)
      .set({ status: "completed" })
      .where(eq(jobRuns.id, existing.id));

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

  it("marks the run failed (terminal) and rethrows when queue.add fails", async () => {
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

    // The insert happened before add; find the newest failed run for this name.
    const rows = await db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.name, "test.client.queue-fail"));

    assert.ok(rows.length >= 1);
    const failed = rows[rows.length - 1]!;
    trackId(failed.id);
    assert.equal(failed.status, "failed");
    assert.equal(failed.error, "redis unavailable");
    assert.ok(failed.finishedAt);
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
});
