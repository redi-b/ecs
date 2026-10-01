import assert from "node:assert/strict";
import { test } from "node:test";
import type { JobHandlerContext } from "@ecs/jobs";
import { createDomainReconciliationHandlers } from "./domain-reconciliation.js";

const context = (payload: unknown, tenantId: string | null = null): JobHandlerContext => ({
  attempt: 1,
  jobRunId: "scan-run",
  name: "domains.scan",
  payload,
  signal: new AbortController().signal,
  tenantId,
});

test("domain scan publishes expired/disabled routes and queues bounded tenant-scoped pages", async () => {
  const calls: unknown[] = [];
  const jobs = createDomainReconciliationHandlers({
    enabled: () => true,
    publishDesired: async () => {
      calls.push("publish");
      return { acquired: true };
    },
    listPage: async (cursor) => {
      assert.equal(cursor, undefined);
      return Array.from({ length: 100 }, (_, index) => ({
        id: `domain-${index}`,
        tenantId: `tenant-${index}`,
      }));
    },
    reconcileOne: async () => ({ outcome: "updated", routing: { acquired: true } }),
    jobsClient: {
      enqueueJob: async (input) => {
        calls.push(input);
        return { jobRunId: "queued", name: input.name, status: "queued", reused: false };
      },
    },
  });
  await jobs.scan(context({ source: "bullmq_repeatable" }));
  assert.equal(calls.length, 102);
  assert.equal(calls[0], "publish");
  assert.deepEqual(calls[1], {
    name: "domains.reconcile",
    tenantId: "tenant-0",
    payload: { domainId: "domain-0" },
    idempotencyKey: "domains:scan-run:domain-0",
  });
  assert.deepEqual(calls.at(-1), {
    name: "domains.scan",
    payload: { source: "continuation", scanId: "scan-run", cursor: "domain-99" },
    idempotencyKey: "domains:scan-run:after:domain-99",
  });
});

test("disabled domain scan still withdraws routes without probing tenants", async () => {
  let published = 0;
  const jobs = createDomainReconciliationHandlers({
    enabled: () => false,
    publishDesired: async () => ({ acquired: ++published > 0 }),
    listPage: async () => {
      throw new Error("must not list");
    },
    reconcileOne: async () => {
      throw new Error("must not probe");
    },
    jobsClient: {
      enqueueJob: async () => {
        throw new Error("must not enqueue");
      },
    },
  });
  await jobs.scan(context({ source: "bullmq_repeatable" }));
  assert.equal(published, 1);
});

test("domain reconciliation rejects missing tenant and retries transient observations", async () => {
  let observed: unknown;
  const jobs = createDomainReconciliationHandlers({
    enabled: () => true,
    publishDesired: async () => ({ acquired: true }),
    listPage: async () => [],
    reconcileOne: async (input) => {
      observed = input;
      return { outcome: "retry", reason: "dns_unavailable", routing: { acquired: true } };
    },
    jobsClient: {
      enqueueJob: async () => {
        throw new Error("must not enqueue");
      },
    },
  });
  await assert.rejects(jobs.reconcile(context({ domainId: "domain" })), /tenant_required/);
  assert.equal(observed, undefined);
  await assert.rejects(
    jobs.reconcile(context({ domainId: "domain" }, "tenant")),
    /dns_unavailable/,
  );
  assert.deepEqual(observed, { domainId: "domain", tenantId: "tenant" });
});
