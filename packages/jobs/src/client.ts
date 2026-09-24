import { Queue } from "bullmq";
import type { Redis } from "ioredis";

import { createRedisConnection } from "./connection.js";
import {
  DEFAULT_BACKOFF_MS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_QUEUE_NAME,
  DEFAULT_REDIS_PREFIX,
} from "./defaults.js";
import { type ReconciliationSummary, reconcileQueuedJobs } from "./reconcile.js";
import type { JobQueueClass, JobRegistry } from "./registry.js";
import {
  type RemoveRepeatableJobInput,
  removeRepeatableJobOnQueue,
  type ScheduleRepeatableJobInput,
  type ScheduleRepeatableJobResult,
  scheduleRepeatableJobOnQueue,
} from "./repeatable.js";
import {
  deleteExpiredJobRuns,
  findJobRunById,
  findJobRunByIdempotency,
  type InsertJobRunInput,
  insertJobRun,
  listActiveJobRunsBefore,
  listOperationalJobRuns,
  listQueuedJobRunsBefore,
  markJobRunCancelled,
  markJobRunCompleted,
  markJobRunFailed,
  markJobRunQueued,
  recordJobRunError,
  setBullmqJobId,
  shouldReuseExistingRun,
} from "./runs.js";
import type {
  EnqueueJobInput,
  EnqueueJobResult,
  JobControlResult,
  JobQueueHealth,
  JobRunRecord,
  JobRunSummary,
  JobSchedulerHealth,
  PlatformDb,
} from "./types.js";

export type JobsLogger = {
  error?: (obj: Record<string, unknown>, msg?: string) => void;
  warn?: (obj: Record<string, unknown>, msg?: string) => void;
  info?: (obj: Record<string, unknown>, msg?: string) => void;
};

export type JobsClientOptions = {
  redisUrl: string;
  db: PlatformDb;
  queueName?: string;
  prefix?: string;
  logger?: JobsLogger;
  registry?: JobRegistry;
};

/** Minimal queue surface used by enqueue so tests can inject a fake. */
export type JobsQueueLike = {
  add(
    name: string,
    data: {
      jobRunId: string | null;
      tenantId: string | null;
      payload: unknown;
    },
    opts: {
      jobId?: string;
      attempts: number;
      backoff: { type: "exponential" | "fixed"; delay: number; jitter?: number };
      repeat?: { every: number; key?: string };
      removeOnComplete?: number | boolean | { age: number };
      removeOnFail?: number | boolean | { age: number };
    },
  ): Promise<{ id?: string | null | undefined }>;
};

export type JobsClient = {
  ping(): Promise<void>;
  enqueueJob(input: EnqueueJobInput): Promise<EnqueueJobResult>;
  getJobRun(id: string): Promise<JobRunRecord | null>;
  /**
   * BullMQ native repeatable job (every N ms). Worker creates a job_runs row per fire.
   * Pass everyMs <= 0 via callers to skip; use removeRepeatableJob to clear.
   */
  scheduleRepeatableJob(input: ScheduleRepeatableJobInput): Promise<ScheduleRepeatableJobResult>;
  removeRepeatableJob(input: RemoveRepeatableJobInput): Promise<boolean>;
  reconcileQueued(input?: { limit?: number; olderThanMs?: number }): Promise<ReconciliationSummary>;
  getQueueHealth(): Promise<JobQueueHealth[]>;
  getSchedulerHealth(): Promise<JobSchedulerHealth>;
  recordSchedulerHeartbeat(input: { buildVersion: string; ttlMs: number }): Promise<void>;
  listOperationalJobs(input?: { limit?: number }): Promise<JobRunSummary[]>;
  retryFailedJob(id: string): Promise<JobControlResult>;
  cancelQueuedJob(id: string): Promise<JobControlResult>;
  cleanupExpiredRuns(): Promise<{ deleted: number }>;
  close(): Promise<void>;
};

function summarizeRun(run: JobRunRecord, registry?: JobRegistry): JobRunSummary {
  return {
    id: run.id,
    tenantId: run.tenantId,
    name: run.name,
    status: run.status,
    errorCode: sanitizeErrorCode(run.error),
    attempts: run.attempts,
    maxAttempts: run.maxAttempts,
    bullmqJobId: run.bullmqJobId,
    queuedAt: run.queuedAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    canCancel: run.status === "queued",
    canRetry: run.status === "failed" && registry?.get(run.name)?.manualRetry === "safe",
  };
}

function sanitizeErrorCode(error: string | null) {
  if (!error) return null;
  const code = error
    .split(":", 1)[0]
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  return code?.slice(0, 80) || "job_failed";
}

async function scanKeys(connection: Redis, pattern: string) {
  let cursor = "0";
  const keys: string[] = [];
  do {
    const [nextCursor, page] = await connection.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    keys.push(...page);
  } while (cursor !== "0");
  return keys;
}

export type EnqueueWithQueueOptions = {
  db: PlatformDb;
  queue: JobsQueueLike;
  input: EnqueueJobInput;
  logger?: JobsLogger;
  registry?: JobRegistry;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function assertValidJobName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Job name must be non-empty");
  }
  return trimmed;
}

function buildInsertInput(name: string, input: EnqueueJobInput): InsertJobRunInput {
  const insert: InsertJobRunInput = { name };
  if (input.payload !== undefined) {
    insert.payload = input.payload;
  }
  if (input.tenantId !== undefined) {
    insert.tenantId = input.tenantId;
  }
  if (input.idempotencyKey !== undefined) {
    insert.idempotencyKey = input.idempotencyKey;
  }
  if (input.maxAttempts !== undefined) {
    insert.maxAttempts = input.maxAttempts;
  }
  return insert;
}

/**
 * Core enqueue path (DB + queue). Exported for unit tests that inject a fake queue.
 */
export async function enqueueWithQueue(
  options: EnqueueWithQueueOptions,
): Promise<EnqueueJobResult> {
  const { db, queue, input, logger, registry } = options;
  const name = assertValidJobName(input.name);
  const definition = registry?.require(name);
  const payload = registry ? registry.parsePayload(name, input.payload ?? {}) : input.payload;
  if (definition?.idempotency === "required" && !input.idempotencyKey?.trim()) {
    throw new Error(`Job requires an idempotency key: ${name}`);
  }

  if (input.idempotencyKey !== undefined && input.idempotencyKey !== "") {
    const existing = await findJobRunByIdempotency(db, name, input.idempotencyKey);
    if (existing && shouldReuseExistingRun(existing.status)) {
      return {
        jobRunId: existing.id,
        name: existing.name,
        status: existing.status,
        reused: true,
      };
    }
  }

  const maxAttempts = definition?.attempts ?? input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const run = await insertJobRun(db, buildInsertInput(name, { ...input, maxAttempts, payload }));

  try {
    const job = await queue.add(
      name,
      {
        jobRunId: run.id,
        tenantId: run.tenantId,
        payload: run.payload,
      },
      {
        jobId: run.id,
        attempts: maxAttempts,
        backoff: {
          type: definition?.backoff.type ?? "exponential",
          delay: definition?.backoff.delayMs ?? DEFAULT_BACKOFF_MS,
          ...(definition ? { jitter: definition.backoff.jitter } : {}),
        },
        ...(definition
          ? {
              removeOnComplete: { age: definition.retention.completedSeconds },
              removeOnFail: { age: definition.retention.failedSeconds },
            }
          : {}),
      },
    );

    const bullmqJobId = job.id ?? run.id;
    await setBullmqJobId(db, run.id, bullmqJobId);

    return {
      jobRunId: run.id,
      name: run.name,
      status: "queued",
      reused: false,
    };
  } catch (error) {
    const message = errorMessage(error);
    logger?.error?.(
      { err: message, jobRunId: run.id, name: run.name },
      "Failed to enqueue job on BullMQ",
    );
    await recordJobRunError(db, run.id, `enqueue_failed:${message}`);
    throw error;
  }
}

export function createJobsClient(options: JobsClientOptions): JobsClient {
  const queueName = options.queueName ?? DEFAULT_QUEUE_NAME;
  const prefix = options.prefix ?? DEFAULT_REDIS_PREFIX;
  const connection: Redis = createRedisConnection(options.redisUrl);
  const queueClasses: Array<JobQueueClass | null> = options.registry
    ? ["critical", "default", "bulk"]
    : [null];
  const queues = new Map(
    queueClasses.map((queueClass) => [
      queueClass,
      new Queue(queueClass ? `${queueName}-${queueClass}` : queueName, { connection, prefix }),
    ]),
  );
  const queueFor = (name: string) => {
    const queueClass = options.registry?.require(name).queue ?? null;
    const queue = queues.get(queueClass);
    if (!queue) throw new Error(`Queue is not configured for job: ${name}`);
    return queue;
  };
  const schedulerHeartbeatKey = `${prefix}:${queueName}:scheduler-heartbeat`;

  return {
    async ping() {
      await connection.ping();
    },
    enqueueJob(input) {
      const enqueueOptions: EnqueueWithQueueOptions = {
        db: options.db,
        queue: queueFor(input.name.trim()),
        input,
      };
      if (options.logger !== undefined) {
        enqueueOptions.logger = options.logger;
      }
      if (options.registry !== undefined) {
        enqueueOptions.registry = options.registry;
      }
      return enqueueWithQueue(enqueueOptions);
    },
    getJobRun(id) {
      return findJobRunById(options.db, id);
    },
    scheduleRepeatableJob(input) {
      return scheduleRepeatableJobOnQueue(queueFor(input.name), input);
    },
    removeRepeatableJob(input) {
      return removeRepeatableJobOnQueue(queueFor(input.name), input);
    },
    async reconcileQueued(input = {}) {
      if (!options.registry) throw new Error("Job registry is required for reconciliation");
      return reconcileQueuedJobs({
        before: new Date(Date.now() - (input.olderThanMs ?? 30_000)),
        limit: input.limit ?? 100,
        queue: {
          add: (name, data, jobOptions) => queueFor(name).add(name, data, jobOptions),
          async inspect(jobId, name) {
            const queue = queueFor(name);
            const job = await queue.getJob(jobId);
            if (!job) return { state: "missing" as const };
            return {
              failedReason: job.failedReason,
              result: job.returnvalue,
              state: await job.getState(),
            };
          },
        },
        registry: options.registry,
        store: {
          listActiveBefore: (before, limit) => listActiveJobRunsBefore(options.db, before, limit),
          listQueuedBefore: (before, limit) => listQueuedJobRunsBefore(options.db, before, limit),
          markCompleted: (id, result) => markJobRunCompleted(options.db, id, result),
          markFailed: (id, error) => markJobRunFailed(options.db, id, error, true),
          markQueued: (id) => markJobRunQueued(options.db, id),
          recordError: (id, error) => recordJobRunError(options.db, id, error),
          setBullmqJobId: (id, bullmqJobId) => setBullmqJobId(options.db, id, bullmqJobId),
        },
      });
    },
    async getQueueHealth() {
      if (!options.registry) throw new Error("Job registry is required for queue health");
      return Promise.all(
        (["critical", "default", "bulk"] as const).map(async (queueClass) => {
          const queue = queues.get(queueClass);
          if (!queue) throw new Error(`Queue is not configured: ${queueClass}`);
          const [counts, waiting, heartbeatKeys] = await Promise.all([
            queue.getJobCounts("active", "delayed", "failed", "paused", "prioritized", "waiting"),
            queue.getJobs(["waiting", "prioritized", "delayed"], 0, 0, true),
            scanKeys(connection, `${prefix}:${queue.name}:worker-heartbeat:*`),
          ]);
          const heartbeatValues = heartbeatKeys.length
            ? await connection.mget(...heartbeatKeys)
            : [];
          const workers = heartbeatValues.flatMap((value) => {
            if (!value) return [];
            try {
              const parsed = JSON.parse(value) as Record<string, unknown>;
              const lastSeenAt = new Date(String(parsed.lastSeenAt ?? ""));
              if (
                typeof parsed.workerId !== "string" ||
                typeof parsed.buildVersion !== "string" ||
                Number.isNaN(lastSeenAt.getTime())
              )
                return [];
              return [
                {
                  buildVersion: parsed.buildVersion,
                  lastSeenAt,
                  workerId: parsed.workerId,
                },
              ];
            } catch {
              return [];
            }
          });
          const timestamp = waiting[0]?.timestamp;
          return {
            queue: queueClass,
            counts: {
              active: counts.active ?? 0,
              delayed: counts.delayed ?? 0,
              failed: counts.failed ?? 0,
              paused: counts.paused ?? 0,
              prioritized: counts.prioritized ?? 0,
              waiting: counts.waiting ?? 0,
            },
            oldestWaitingAt: typeof timestamp === "number" ? new Date(timestamp) : null,
            workers,
          };
        }),
      );
    },
    async getSchedulerHealth() {
      const value = await connection.get(schedulerHeartbeatKey);
      if (!value) return null;
      try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        const lastSeenAt = new Date(String(parsed.lastSeenAt ?? ""));
        if (typeof parsed.buildVersion !== "string" || Number.isNaN(lastSeenAt.getTime())) {
          return null;
        }
        return { buildVersion: parsed.buildVersion, lastSeenAt };
      } catch {
        return null;
      }
    },
    async recordSchedulerHeartbeat(input) {
      await connection.set(
        schedulerHeartbeatKey,
        JSON.stringify({ buildVersion: input.buildVersion, lastSeenAt: new Date().toISOString() }),
        "PX",
        Math.max(1_000, Math.floor(input.ttlMs)),
      );
    },
    async listOperationalJobs(input = {}) {
      const runs = await listOperationalJobRuns(
        options.db,
        Math.min(Math.max(input.limit ?? 20, 1), 100),
      );
      return runs.map((run) => summarizeRun(run, options.registry));
    },
    async retryFailedJob(id) {
      const previous = await findJobRunById(options.db, id);
      if (!previous) return { error: "job_not_found", ok: false };
      const definition = options.registry?.get(previous.name);
      if (previous.status !== "failed" || definition?.manualRetry !== "safe") {
        return { error: "job_not_retryable", ok: false };
      }
      const result = await enqueueWithQueue({
        db: options.db,
        input: {
          name: previous.name,
          payload: previous.payload,
          tenantId: previous.tenantId,
          ...(definition.idempotency === "required"
            ? { idempotencyKey: `${previous.id}:manual:${crypto.randomUUID()}` }
            : {}),
        },
        queue: queueFor(previous.name),
        ...(options.logger ? { logger: options.logger } : {}),
        ...(options.registry ? { registry: options.registry } : {}),
      });
      const run = await findJobRunById(options.db, result.jobRunId);
      if (!run) throw new Error("Retried job run was not persisted");
      return { ok: true, run: summarizeRun(run, options.registry) };
    },
    async cancelQueuedJob(id) {
      const run = await findJobRunById(options.db, id);
      if (!run) return { error: "job_not_found", ok: false };
      if (run.status !== "queued") return { error: "job_not_cancellable", ok: false };
      const job = await queueFor(run.name).getJob(run.bullmqJobId ?? run.id);
      if (job) {
        const state = await job.getState();
        if (!(["waiting", "delayed", "prioritized"] as string[]).includes(state)) {
          return { error: "job_state_changed", ok: false };
        }
        await job.remove();
      }
      const cancelled = await markJobRunCancelled(options.db, id);
      if (!cancelled) return { error: "job_state_changed", ok: false };
      return { ok: true, run: summarizeRun(cancelled, options.registry) };
    },
    async cleanupExpiredRuns() {
      if (!options.registry) throw new Error("Job registry is required for retention cleanup");
      return deleteExpiredJobRuns(
        options.db,
        options.registry.definitions.map((definition) => ({
          completedSeconds: definition.retention.completedSeconds,
          failedSeconds: definition.retention.failedSeconds,
          name: definition.name,
        })),
      );
    },
    async close() {
      await Promise.all([...queues.values()].map((queue) => queue.close()));
      await connection.quit();
    },
  };
}
