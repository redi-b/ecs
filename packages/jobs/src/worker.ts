import { randomUUID } from "node:crypto";
import { UnrecoverableError, Worker } from "bullmq";
import type { Redis } from "ioredis";

import { createRedisConnection } from "./connection.js";
import {
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_QUEUE_NAME,
  DEFAULT_REDIS_PREFIX,
} from "./defaults.js";
import {
  InvalidJobPayloadError,
  InvalidJobResultError,
  type JobQueueClass,
  type JobRegistry,
  UnknownJobDefinitionError,
} from "./registry.js";
import {
  findJobRunByIdempotency,
  insertJobRun,
  markJobRunActive,
  markJobRunCompleted,
  markJobRunFailed,
  setBullmqJobId,
} from "./runs.js";
import type { JobHandler, PlatformDb } from "./types.js";

/** Pino-compatible structured logger: (obj, msg) first-arg shape. */
export type WorkerLogger = {
  info?: (obj: Record<string, unknown>, msg?: string) => void;
  warn?: (obj: Record<string, unknown>, msg?: string) => void;
  error?: (obj: Record<string, unknown>, msg?: string) => void;
  debug?: (obj: Record<string, unknown>, msg?: string) => void;
};

export type StartPlatformWorkerOptions = {
  redisUrl: string;
  db: PlatformDb;
  handlers: Record<string, JobHandler>;
  queueName?: string;
  prefix?: string;
  concurrency?: number;
  logger?: WorkerLogger;
  registry?: JobRegistry;
  buildVersion?: string;
  heartbeatMs?: number;
  workerId?: string;
};

export type PlatformJobData = {
  /**
   * One-shot enqueues set this to the job_runs id.
   * BullMQ repeatables leave it null; the worker inserts a row per fire.
   */
  jobRunId: string | null;
  tenantId: string | null;
  payload: unknown;
};

/** Minimal job surface used by the processor so tests can inject fakes. */
export type PlatformWorkerJob = {
  name: string;
  id?: string | null | undefined;
  data: PlatformJobData;
  attemptsMade: number;
  opts: {
    attempts?: number;
  };
};

export type JobProcessorLifecycle = {
  markActive: (jobRunId: string, attempt: number) => Promise<unknown>;
  markCompleted: (jobRunId: string, result: unknown) => Promise<unknown>;
  markFailed: (jobRunId: string, error: string, terminal: boolean) => Promise<unknown>;
};

export type CreateJobProcessorOptions = {
  db: PlatformDb;
  handlers: Record<string, JobHandler>;
  logger?: WorkerLogger;
  /** Optional lifecycle override for unit tests without a real DB. */
  lifecycle?: JobProcessorLifecycle;
  registry?: JobRegistry;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function safeFailureCode(error: unknown) {
  const value = errorMessage(error);
  if (value === "job_timeout" || /^job_[a-z0-9_]+$/.test(value)) return value;
  if (typeof error === "object" && error && "code" in error) {
    const code = String(error.code).trim().toLowerCase();
    if (/^[a-z][a-z0-9_-]{1,79}$/.test(code)) return code;
  }
  return error instanceof UnrecoverableError ? "job_unrecoverable" : "job_failed";
}

export function resolveHandler(
  handlers: Record<string, JobHandler>,
  name: string,
): JobHandler | undefined {
  return handlers[name];
}

function createDefaultLifecycle(db: PlatformDb): JobProcessorLifecycle {
  return {
    markActive: (jobRunId, attempt) => markJobRunActive(db, jobRunId, attempt),
    markCompleted: (jobRunId, result) => markJobRunCompleted(db, jobRunId, result),
    markFailed: (jobRunId, error, terminal) => markJobRunFailed(db, jobRunId, error, terminal),
  };
}

/**
 * Pure processor factory — unit-testable without Redis.
 * Returns the async job function passed to BullMQ Worker.
 */
export function createJobProcessor(
  options: CreateJobProcessorOptions,
): (job: PlatformWorkerJob) => Promise<unknown> {
  const { handlers, logger } = options;
  const lifecycle = options.lifecycle ?? createDefaultLifecycle(options.db);

  return async function processJob(job: PlatformWorkerJob): Promise<unknown> {
    const name = job.name;
    const rawPayload = job.data.payload;
    const tenantId = job.data.tenantId ?? null;
    const attempt = job.attemptsMade + 1;

    // Repeatable jobs arrive without a pre-created job_runs row.
    let jobRunId = job.data.jobRunId?.trim() || null;
    if (!jobRunId) {
      if (!options.lifecycle) {
        const idempotencyKey = job.id ? `bullmq:${job.id}` : undefined;
        // Retries re-use the same BullMQ job id — reuse the job_runs row.
        if (idempotencyKey) {
          const existing = await findJobRunByIdempotency(options.db, name, idempotencyKey);
          if (existing) {
            jobRunId = existing.id;
          }
        }
        if (!jobRunId) {
          const run = await insertJobRun(options.db, {
            name,
            tenantId,
            payload: rawPayload ?? {},
            ...(idempotencyKey ? { idempotencyKey } : {}),
          });
          jobRunId = run.id;
          if (job.id) {
            await setBullmqJobId(options.db, jobRunId, job.id);
          }
        }
      } else {
        // Unit tests inject lifecycle without DB insert support.
        jobRunId = job.id?.trim() || `synthetic:${name}:${attempt}`;
      }
    }

    let payload = rawPayload;
    if (options.registry) {
      try {
        payload = options.registry.parsePayload(name, rawPayload ?? {});
      } catch (error) {
        if (error instanceof InvalidJobPayloadError || error instanceof UnknownJobDefinitionError) {
          logger?.error?.({ code: error.code, jobRunId, name }, "Job rejected before handling");
          await lifecycle.markFailed(jobRunId, error.code, true);
          throw new UnrecoverableError(error.code);
        }
        throw error;
      }
    }

    const handler = resolveHandler(handlers, name);
    if (!handler) {
      const message = `No handler registered for job "${name}"`;
      logger?.error?.({ jobRunId, name }, message);
      await lifecycle.markFailed(jobRunId, message, true);
      throw new UnrecoverableError(message);
    }

    await lifecycle.markActive(jobRunId, attempt);
    logger?.debug?.({ jobRunId, name, attempt }, "Job active");

    const controller = new AbortController();
    const timeoutMs = options.registry?.get(name)?.timeoutMs;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const handling = handler({
        attempt,
        jobRunId,
        name,
        payload,
        signal: controller.signal,
        tenantId,
      });
      const rawResult = timeoutMs
        ? await Promise.race([
            handling,
            new Promise<never>((_resolve, reject) => {
              timeout = setTimeout(() => {
                controller.abort(new Error("job_timeout"));
                reject(new Error("job_timeout"));
              }, timeoutMs);
            }),
          ])
        : await handling;
      let result = rawResult;
      try {
        result = options.registry ? options.registry.parseResult(name, rawResult) : rawResult;
      } catch (error) {
        if (error instanceof InvalidJobResultError) {
          throw new UnrecoverableError(error.code);
        }
        throw error;
      }
      await lifecycle.markCompleted(jobRunId, result);
      logger?.info?.({ jobRunId, name, attempt }, "Job completed");
      return result;
    } catch (error) {
      const failureCode = safeFailureCode(error);
      const maxAttempts = job.opts.attempts ?? DEFAULT_MAX_ATTEMPTS;
      const isUnrecoverable = error instanceof UnrecoverableError;
      const retryPolicy = options.registry?.get(name)?.retry ?? "always";
      const terminal = isUnrecoverable || retryPolicy === "never" || attempt >= maxAttempts;

      logger?.error?.(
        {
          jobRunId,
          name,
          attempt,
          terminal,
          code: failureCode,
        },
        "Job failed",
      );
      await lifecycle.markFailed(jobRunId, failureCode, terminal);
      if (terminal && !isUnrecoverable && attempt < maxAttempts) {
        throw new UnrecoverableError(failureCode);
      }
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
}

export function startPlatformWorker(options: StartPlatformWorkerOptions): {
  close: (force?: boolean) => Promise<void>;
} {
  const queueName = options.queueName ?? DEFAULT_QUEUE_NAME;
  const prefix = options.prefix ?? DEFAULT_REDIS_PREFIX;
  const concurrency =
    options.concurrency && Number.isInteger(options.concurrency) && options.concurrency > 0
      ? options.concurrency
      : DEFAULT_CONCURRENCY;
  const connection: Redis = createRedisConnection(options.redisUrl);

  const processorOptions: CreateJobProcessorOptions = {
    db: options.db,
    handlers: options.handlers,
  };
  if (options.logger !== undefined) {
    processorOptions.logger = options.logger;
  }
  if (options.registry !== undefined) {
    processorOptions.registry = options.registry;
  }

  const processJob = createJobProcessor(processorOptions);

  const worker = new Worker(queueName, processJob, {
    connection,
    prefix,
    concurrency,
  });
  const workerId = options.workerId?.trim() || randomUUID();
  const heartbeatMs =
    options.heartbeatMs && Number.isFinite(options.heartbeatMs) && options.heartbeatMs >= 1_000
      ? options.heartbeatMs
      : 10_000;
  const heartbeatKey = `${prefix}:${queueName}:worker-heartbeat:${workerId}`;

  worker.on("error", (error) => {
    options.logger?.error?.({ err: error.message, queueName, workerId }, "Worker error");
  });
  worker.on("failed", (job, error) => {
    options.logger?.warn?.(
      { err: error.message, jobId: job?.id, name: job?.name, queueName, workerId },
      "Worker job attempt failed",
    );
  });
  worker.on("stalled", (jobId) => {
    options.logger?.warn?.({ jobId, queueName, workerId }, "Worker job stalled");
  });
  worker.on("completed", (job) => {
    options.logger?.debug?.(
      { jobId: job.id, name: job.name, queueName, workerId },
      "Worker job completed",
    );
  });

  const writeHeartbeat = async () => {
    const heartbeat = JSON.stringify({
      buildVersion: options.buildVersion ?? "unknown",
      lastSeenAt: new Date().toISOString(),
      queueName,
      workerId,
    });
    await connection.set(heartbeatKey, heartbeat, "PX", Math.max(heartbeatMs * 3, 1_000));
  };
  void writeHeartbeat().catch((error) => {
    options.logger?.warn?.({ err: errorMessage(error), workerId }, "Worker heartbeat failed");
  });
  const heartbeatTimer = setInterval(() => {
    void writeHeartbeat().catch((error) => {
      options.logger?.warn?.({ err: errorMessage(error), workerId }, "Worker heartbeat failed");
    });
  }, heartbeatMs);
  heartbeatTimer.unref();

  options.logger?.info?.(
    {
      queueName,
      prefix,
      concurrency,
      handlers: Object.keys(options.handlers),
    },
    "Platform worker started",
  );

  return {
    async close(force = false) {
      clearInterval(heartbeatTimer);
      await connection.del(heartbeatKey).catch(() => undefined);
      await worker.close(force);
      await connection.quit();
    },
  };
}

export function startPlatformWorkers(
  options: Omit<StartPlatformWorkerOptions, "queueName"> & {
    concurrencyByQueue?: Partial<Record<JobQueueClass, number>>;
    queueName?: string;
    registry: JobRegistry;
  },
): { close: (force?: boolean) => Promise<void> } {
  const baseQueueName = options.queueName ?? DEFAULT_QUEUE_NAME;
  const workers = (["critical", "default", "bulk"] as const).map((queueClass) => {
    const handlers = Object.fromEntries(
      Object.entries(options.handlers).filter(
        ([name]) => options.registry.get(name)?.queue === queueClass,
      ),
    );
    const concurrency = options.concurrencyByQueue?.[queueClass] ?? options.concurrency;
    return startPlatformWorker({
      ...options,
      ...(concurrency === undefined ? {} : { concurrency }),
      handlers,
      queueName: `${baseQueueName}-${queueClass}`,
    });
  });

  return {
    async close(force = false) {
      await Promise.all(workers.map((worker) => worker.close(force)));
    },
  };
}
