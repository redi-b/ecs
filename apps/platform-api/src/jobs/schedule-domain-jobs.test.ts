import assert from "node:assert/strict";
import { test } from "node:test";
import { registerDomainRepeatableJobs } from "./schedule-domain-jobs.js";

test("domain reconciliation has one stable minute schedule and an idempotent startup scan", async () => {
  const calls: unknown[] = [];
  await registerDomainRepeatableJobs({
    configured: true,
    now: () => 120_000,
    jobsClient: {
      scheduleRepeatableJob: async (input) => {
        calls.push(input);
        return { name: input.name, key: input.key ?? input.name, everyMs: input.everyMs };
      },
      enqueueJob: async (input) => {
        calls.push(input);
        return { name: input.name, jobRunId: "scan", status: "queued", reused: false };
      },
      removeRepeatableJob: async () => {
        throw new Error("must not remove");
      },
    },
  });
  assert.deepEqual(calls, [
    {
      name: "domains.scan",
      key: "domains.scan",
      everyMs: 60_000,
      payload: { source: "bullmq_repeatable" },
    },
    {
      name: "domains.scan",
      idempotencyKey: "domains:startup:2",
      payload: { source: "bullmq_repeatable" },
    },
  ]);
});

test("unconfigured domain runtime removes its own repeatable without enqueueing", async () => {
  let removed: unknown;
  await registerDomainRepeatableJobs({
    configured: false,
    jobsClient: {
      scheduleRepeatableJob: async () => {
        throw new Error("must not schedule");
      },
      enqueueJob: async () => {
        throw new Error("must not enqueue");
      },
      removeRepeatableJob: async (input) => {
        removed = input;
        return true;
      },
    },
  });
  assert.deepEqual(removed, { name: "domains.scan", key: "domains.scan", everyMs: 60_000 });
});
