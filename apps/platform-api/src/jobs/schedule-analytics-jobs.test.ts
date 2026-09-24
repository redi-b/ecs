import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { JobsClient } from "@ecs/jobs";
import {
  DEFAULT_ANALYTICS_ROLLUP_INTERVAL_MS,
  registerAnalyticsRepeatableJobs,
} from "./schedule-analytics-jobs.js";

describe("analytics repeatable jobs", () => {
  it("registers a stable six-hour commerce rollup", async () => {
    const scheduled: unknown[] = [];
    const enqueued: unknown[] = [];
    await registerAnalyticsRepeatableJobs({
      jobsClient: {
        enqueueJob: async (input) => {
          enqueued.push(input);
          return { jobRunId: "job_1", name: input.name, reused: false, status: "queued" };
        },
        scheduleRepeatableJob: async (input) => {
          scheduled.push(input);
          return { everyMs: input.everyMs, key: input.key ?? input.name, name: input.name };
        },
      } as JobsClient,
      now: () => new Date("2026-08-26T09:00:00.000Z"),
    });

    assert.deepEqual(scheduled, [
      {
        everyMs: DEFAULT_ANALYTICS_ROLLUP_INTERVAL_MS,
        key: "analytics.commerce-rollup",
        name: "analytics.commerce-rollup",
        payload: { source: "bullmq_repeatable" },
      },
    ]);
    assert.deepEqual(enqueued, [
      {
        idempotencyKey: "analytics-commerce-rollup:startup:1986372",
        name: "analytics.commerce-rollup",
        payload: { source: "worker_startup" },
      },
    ]);
  });

  it("waits for commerce before enqueueing the startup rollup", async () => {
    const enqueued: unknown[] = [];
    const readiness = [false, false, true];
    const waits: number[] = [];
    await registerAnalyticsRepeatableJobs({
      isCommerceReady: async () => readiness.shift() ?? true,
      jobsClient: {
        enqueueJob: async (input) => {
          enqueued.push(input);
          return { jobRunId: "job_1", name: input.name, reused: false, status: "queued" };
        },
        scheduleRepeatableJob: async (input) => ({
          everyMs: input.everyMs,
          key: input.key ?? input.name,
          name: input.name,
        }),
      } as JobsClient,
      startupRetryMs: 25,
      waitForStartupRetry: async (delayMs) => {
        waits.push(delayMs);
        return true;
      },
    });
    assert.deepEqual(waits, [25, 25]);
    assert.equal(enqueued.length, 1);
  });

  it("stops waiting without enqueueing when shutdown begins", async () => {
    const enqueued: unknown[] = [];
    const controller = new AbortController();
    await registerAnalyticsRepeatableJobs({
      isCommerceReady: async () => false,
      jobsClient: {
        enqueueJob: async (input) => {
          enqueued.push(input);
          return { jobRunId: "job_1", name: input.name, reused: false, status: "queued" };
        },
        scheduleRepeatableJob: async (input) => ({
          everyMs: input.everyMs,
          key: input.key ?? input.name,
          name: input.name,
        }),
      } as JobsClient,
      signal: controller.signal,
      waitForStartupRetry: async () => {
        controller.abort();
        return false;
      },
    });
    assert.deepEqual(enqueued, []);
  });
});
