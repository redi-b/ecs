import type { JobRegistry } from "./registry.js";
import type { JobRunRecord } from "./types.js";

export type ReconciliationJobState =
  | "active"
  | "completed"
  | "delayed"
  | "failed"
  | "prioritized"
  | "waiting"
  | "waiting-children"
  | "unknown";

export type ReconciliationQueue = {
  add: (
    name: string,
    data: { jobRunId: string; payload: unknown; tenantId: string | null },
    options: {
      attempts: number;
      backoff: { delay: number; jitter: number; type: "exponential" | "fixed" };
      jobId: string;
      removeOnComplete: { age: number };
      removeOnFail: { age: number };
    },
  ) => Promise<{ id?: string | null }>;
  inspect: (
    jobId: string,
    name: string,
  ) => Promise<{
    failedReason?: string;
    result?: unknown;
    state: ReconciliationJobState | "missing";
  }>;
};

export type ReconciliationStore = {
  listQueuedBefore: (before: Date, limit: number) => Promise<JobRunRecord[]>;
  listActiveBefore: (before: Date, limit: number) => Promise<JobRunRecord[]>;
  markCompleted: (id: string, result: unknown) => Promise<unknown>;
  markFailed: (id: string, error: string) => Promise<unknown>;
  markQueued: (id: string) => Promise<unknown>;
  recordError: (id: string, error: string | null) => Promise<unknown>;
  setBullmqJobId: (id: string, bullmqJobId: string) => Promise<unknown>;
};

export type ReconciliationSummary = {
  examined: number;
  present: number;
  recovered: number;
  rejected: number;
  repaired: number;
};

const USABLE_STATES = new Set<ReconciliationJobState>([
  "active",
  "delayed",
  "prioritized",
  "waiting",
  "waiting-children",
]);

export async function reconcileQueuedJobs(options: {
  before: Date;
  limit: number;
  queue: ReconciliationQueue;
  registry: JobRegistry;
  store: ReconciliationStore;
}): Promise<ReconciliationSummary> {
  const runs = await options.store.listQueuedBefore(options.before, options.limit);
  const activeRuns = await options.store.listActiveBefore(options.before, options.limit);
  const summary: ReconciliationSummary = {
    examined: runs.length + activeRuns.length,
    present: 0,
    recovered: 0,
    rejected: 0,
    repaired: 0,
  };

  for (const run of runs) {
    const definition = options.registry.get(run.name);
    if (!definition) {
      await options.store.recordError(run.id, "job_definition_unknown");
      summary.rejected += 1;
      continue;
    }

    const jobId = run.bullmqJobId ?? run.id;
    const { state } = await options.queue.inspect(jobId, run.name);
    if (state !== "missing" && USABLE_STATES.has(state)) {
      summary.present += 1;
      continue;
    }
    if (state === "completed" || state === "failed") {
      await options.store.recordError(run.id, `job_state_conflict:${state}`);
      summary.rejected += 1;
      continue;
    }

    const job = await options.queue.add(
      run.name,
      { jobRunId: run.id, payload: run.payload, tenantId: run.tenantId },
      {
        attempts: definition.attempts,
        backoff: {
          delay: definition.backoff.delayMs,
          jitter: definition.backoff.jitter,
          type: definition.backoff.type,
        },
        jobId: run.id,
        removeOnComplete: { age: definition.retention.completedSeconds },
        removeOnFail: { age: definition.retention.failedSeconds },
      },
    );
    await options.store.setBullmqJobId(run.id, job.id ?? run.id);
    await options.store.recordError(run.id, null);
    summary.recovered += 1;
  }

  for (const run of activeRuns) {
    const snapshot = await options.queue.inspect(run.bullmqJobId ?? run.id, run.name);
    if (snapshot.state === "active") {
      summary.present += 1;
      continue;
    }
    if (
      snapshot.state === "waiting" ||
      snapshot.state === "delayed" ||
      snapshot.state === "prioritized" ||
      snapshot.state === "waiting-children"
    ) {
      await options.store.markQueued(run.id);
      summary.repaired += 1;
      continue;
    }
    if (snapshot.state === "completed") {
      await options.store.markCompleted(run.id, snapshot.result ?? null);
      summary.repaired += 1;
      continue;
    }
    if (snapshot.state === "failed") {
      await options.store.markFailed(
        run.id,
        snapshot.failedReason ? `bullmq_failed:${snapshot.failedReason}` : "bullmq_failed",
      );
      summary.repaired += 1;
      continue;
    }
    await options.store.markFailed(run.id, "job_lost_after_active");
    summary.rejected += 1;
  }

  return summary;
}
