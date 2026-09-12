import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { UnrecoverableError } from "bullmq";
import { z } from "zod";

import { DEFAULT_MAX_ATTEMPTS } from "./defaults.js";
import { createJobRegistry, defineJob } from "./registry.js";
import type { JobHandler, JobHandlerContext, PlatformDb } from "./types.js";
import {
  createJobProcessor,
  type JobProcessorLifecycle,
  type PlatformWorkerJob,
  resolveHandler,
} from "./worker.js";

const fakeDb = {} as PlatformDb;
const registry = createJobRegistry([
  defineJob({
    attempts: 3,
    backoff: { delayMs: 100, jitter: 0, type: "fixed" },
    idempotency: "optional",
    manualRetry: "safe",
    name: "example.job",
    payloadSchema: z.object({ foo: z.string() }),
    queue: "default",
    resultSchema: z.object({ done: z.boolean() }),
    retention: { completedSeconds: 60, failedSeconds: 60 },
    retry: "classified",
    timeoutMs: 1_000,
    version: 1,
  }),
]);

function createRecordingLifecycle(): JobProcessorLifecycle & {
  calls: Array<
    | { op: "markActive"; jobRunId: string; attempt: number }
    | { op: "markCompleted"; jobRunId: string; result: unknown }
    | { op: "markFailed"; jobRunId: string; error: string; terminal: boolean }
  >;
} {
  const calls: Array<
    | { op: "markActive"; jobRunId: string; attempt: number }
    | { op: "markCompleted"; jobRunId: string; result: unknown }
    | { op: "markFailed"; jobRunId: string; error: string; terminal: boolean }
  > = [];

  return {
    calls,
    async markActive(jobRunId, attempt) {
      calls.push({ op: "markActive", jobRunId, attempt });
    },
    async markCompleted(jobRunId, result) {
      calls.push({ op: "markCompleted", jobRunId, result });
    },
    async markFailed(jobRunId, error, terminal) {
      calls.push({ op: "markFailed", jobRunId, error, terminal });
    },
  };
}

function makeJob(overrides?: Partial<PlatformWorkerJob>): PlatformWorkerJob {
  return {
    name: overrides?.name ?? "example.job",
    id: overrides?.id,
    data: {
      jobRunId: "run-1",
      tenantId: "tenant-1",
      payload: { foo: "bar" },
      ...overrides?.data,
    },
    attemptsMade: overrides?.attemptsMade ?? 0,
    opts: {
      attempts: DEFAULT_MAX_ATTEMPTS,
      ...overrides?.opts,
    },
  };
}

describe("resolveHandler", () => {
  it("returns the handler for a registered name", () => {
    const handler: JobHandler = async () => ({ ok: true });
    const handlers = { "example.job": handler };
    assert.equal(resolveHandler(handlers, "example.job"), handler);
  });

  it("returns undefined when no handler is registered", () => {
    assert.equal(resolveHandler({}, "missing.job"), undefined);
  });
});

describe("createJobProcessor", () => {
  it("rejects an invalid registered payload before invoking its handler", async () => {
    const lifecycle = createRecordingLifecycle();
    let invoked = false;
    const processJob = createJobProcessor({
      db: fakeDb,
      handlers: {
        "example.job": async () => {
          invoked = true;
        },
      },
      lifecycle,
      registry,
    });

    await assert.rejects(
      () => processJob(makeJob({ data: { jobRunId: "run-1", payload: {}, tenantId: null } })),
      (error: unknown) =>
        error instanceof UnrecoverableError && error.message === "job_payload_invalid",
    );
    assert.equal(invoked, false);
    assert.deepEqual(lifecycle.calls, [
      { error: "job_payload_invalid", jobRunId: "run-1", op: "markFailed", terminal: true },
    ]);
  });

  it("rejects an invalid handler result without retrying", async () => {
    const lifecycle = createRecordingLifecycle();
    const processJob = createJobProcessor({
      db: fakeDb,
      handlers: { "example.job": async () => ({ done: "yes" }) },
      lifecycle,
      registry,
    });

    await assert.rejects(
      () => processJob(makeJob()),
      (error: unknown) =>
        error instanceof UnrecoverableError && error.message === "job_result_invalid",
    );
    assert.deepEqual(lifecycle.calls.at(-1), {
      error: "job_result_invalid",
      jobRunId: "run-1",
      op: "markFailed",
      terminal: true,
    });
  });

  it("aborts a handler when its registered deadline expires", async () => {
    const lifecycle = createRecordingLifecycle();
    const timeoutRegistry = createJobRegistry([
      defineJob({
        attempts: 1,
        backoff: { delayMs: 0, jitter: 0, type: "fixed" },
        idempotency: "optional",
        manualRetry: "safe",
        name: "example.job",
        payloadSchema: z.object({ foo: z.string() }),
        queue: "default",
        retention: { completedSeconds: 60, failedSeconds: 60 },
        retry: "classified",
        timeoutMs: 5,
        version: 1,
      }),
    ]);
    let aborted = false;
    const processJob = createJobProcessor({
      db: fakeDb,
      handlers: {
        "example.job": ({ signal }) =>
          new Promise((_resolve) => {
            signal.addEventListener("abort", () => {
              aborted = true;
            });
          }),
      },
      lifecycle,
      registry: timeoutRegistry,
    });

    await assert.rejects(() => processJob(makeJob({ opts: { attempts: 1 } })), /job_timeout/);
    assert.equal(aborted, true);
    assert.deepEqual(lifecycle.calls.at(-1), {
      error: "job_timeout",
      jobRunId: "run-1",
      op: "markFailed",
      terminal: true,
    });
  });

  it("throws UnrecoverableError and marks terminal failed when handler is missing", async () => {
    const lifecycle = createRecordingLifecycle();
    const processJob = createJobProcessor({
      db: fakeDb,
      handlers: {},
      lifecycle,
    });

    const job = makeJob({ name: "unknown.job" });

    await assert.rejects(
      () => processJob(job),
      (error: unknown) => {
        assert.ok(error instanceof UnrecoverableError);
        assert.match(error.message, /No handler registered for job "unknown\.job"/);
        return true;
      },
    );

    assert.deepEqual(lifecycle.calls, [
      {
        op: "markFailed",
        jobRunId: "run-1",
        error: 'No handler registered for job "unknown.job"',
        terminal: true,
      },
    ]);
  });

  it("synthesizes a jobRunId for BullMQ repeatable jobs (null jobRunId)", async () => {
    const lifecycle = createRecordingLifecycle();
    let receivedId: string | undefined;

    const processJob = createJobProcessor({
      db: fakeDb,
      handlers: {
        "billing.reconcile-payments": async (ctx) => {
          receivedId = ctx.jobRunId;
          return { ok: true };
        },
      },
      lifecycle,
    });

    await processJob(
      makeJob({
        name: "billing.reconcile-payments",
        id: "repeat:billing.reconcile-payments:123",
        data: {
          jobRunId: null,
          tenantId: null,
          payload: { source: "bullmq_repeatable" },
        },
      }),
    );

    assert.equal(receivedId, "repeat:billing.reconcile-payments:123");
    assert.equal(lifecycle.calls[0]?.op, "markActive");
    assert.equal(
      lifecycle.calls[0] && "jobRunId" in lifecycle.calls[0] ? lifecycle.calls[0].jobRunId : null,
      "repeat:billing.reconcile-payments:123",
    );
  });

  it("invokes handler with correct context and marks completed on success", async () => {
    const lifecycle = createRecordingLifecycle();
    let received: unknown;

    const processJob = createJobProcessor({
      db: fakeDb,
      handlers: {
        "example.job": async (ctx) => {
          received = ctx;
          return { done: true };
        },
      },
      lifecycle,
    });

    const result = await processJob(makeJob({ attemptsMade: 1 }));

    assert.deepEqual(result, { done: true });
    const context = received as JobHandlerContext;
    assert.ok(context.signal instanceof AbortSignal);
    assert.deepEqual(
      { ...context, signal: undefined },
      {
        jobRunId: "run-1",
        name: "example.job",
        tenantId: "tenant-1",
        payload: { foo: "bar" },
        attempt: 2,
        signal: undefined,
      },
    );
    assert.deepEqual(lifecycle.calls, [
      { op: "markActive", jobRunId: "run-1", attempt: 2 },
      { op: "markCompleted", jobRunId: "run-1", result: { done: true } },
    ]);
  });

  it("normalizes undefined tenantId to null in handler context", async () => {
    const lifecycle = createRecordingLifecycle();
    let tenantId: unknown;

    const processJob = createJobProcessor({
      db: fakeDb,
      handlers: {
        "example.job": async (ctx) => {
          tenantId = ctx.tenantId;
          return null;
        },
      },
      lifecycle,
    });

    await processJob(
      makeJob({
        data: {
          jobRunId: "run-1",
          tenantId: null,
          payload: {},
        },
      }),
    );

    assert.equal(tenantId, null);
  });

  it("marks non-terminal failed and rethrows when attempts remain", async () => {
    const lifecycle = createRecordingLifecycle();
    const processJob = createJobProcessor({
      db: fakeDb,
      handlers: {
        "example.job": async () => {
          throw new Error("transient boom");
        },
      },
      lifecycle,
    });

    await assert.rejects(
      () => processJob(makeJob({ attemptsMade: 0, opts: { attempts: 3 } })),
      /transient boom/,
    );

    assert.deepEqual(lifecycle.calls, [
      { op: "markActive", jobRunId: "run-1", attempt: 1 },
      {
        op: "markFailed",
        jobRunId: "run-1",
        error: "job_failed",
        terminal: false,
      },
    ]);
  });

  it("marks terminal failed on final attempt", async () => {
    const lifecycle = createRecordingLifecycle();
    const processJob = createJobProcessor({
      db: fakeDb,
      handlers: {
        "example.job": async () => {
          throw new Error("final boom");
        },
      },
      lifecycle,
    });

    await assert.rejects(
      () => processJob(makeJob({ attemptsMade: 2, opts: { attempts: 3 } })),
      /final boom/,
    );

    assert.equal(lifecycle.calls.at(-1)?.op, "markFailed");
    assert.deepEqual(lifecycle.calls.at(-1), {
      op: "markFailed",
      jobRunId: "run-1",
      error: "job_failed",
      terminal: true,
    });
  });

  it("uses DEFAULT_MAX_ATTEMPTS when job.opts.attempts is omitted", async () => {
    const lifecycle = createRecordingLifecycle();
    const processJob = createJobProcessor({
      db: fakeDb,
      handlers: {
        "example.job": async () => {
          throw new Error("no attempts opt");
        },
      },
      lifecycle,
    });

    // DEFAULT_MAX_ATTEMPTS is 3; attempt 2 (attemptsMade=1) is non-terminal.
    await assert.rejects(
      () =>
        processJob({
          name: "example.job",
          data: { jobRunId: "run-1", tenantId: null, payload: {} },
          attemptsMade: 1,
          opts: {},
        }),
      /no attempts opt/,
    );

    assert.equal(lifecycle.calls.find((c) => c.op === "markFailed")?.terminal, false);

    lifecycle.calls.length = 0;

    // attempt 3 is terminal under default max attempts.
    await assert.rejects(
      () =>
        processJob({
          name: "example.job",
          data: { jobRunId: "run-1", tenantId: null, payload: {} },
          attemptsMade: 2,
          opts: {},
        }),
      /no attempts opt/,
    );

    assert.equal(lifecycle.calls.find((c) => c.op === "markFailed")?.terminal, true);
  });

  it("marks terminal failed when handler throws UnrecoverableError", async () => {
    const lifecycle = createRecordingLifecycle();
    const processJob = createJobProcessor({
      db: fakeDb,
      handlers: {
        "example.job": async () => {
          throw new UnrecoverableError("poison message");
        },
      },
      lifecycle,
    });

    await assert.rejects(
      () => processJob(makeJob({ attemptsMade: 0, opts: { attempts: 5 } })),
      (error: unknown) => {
        assert.ok(error instanceof UnrecoverableError);
        assert.equal(error.message, "poison message");
        return true;
      },
    );

    assert.deepEqual(lifecycle.calls.at(-1), {
      op: "markFailed",
      jobRunId: "run-1",
      error: "job_unrecoverable",
      terminal: true,
    });
  });
});
