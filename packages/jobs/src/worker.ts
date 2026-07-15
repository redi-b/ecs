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
  markFailed: (
    jobRunId: string,
    error: string,
    terminal: boolean,
  ) => Promise<unknown>;
};

export type CreateJobProcessorOptions = {
  db: PlatformDb;
  handlers: Record<string, JobHandler>;
  logger?: WorkerLogger;
  /** Optional lifecycle override for unit tests without a real DB. */
  lifecycle?: JobProcessorLifecycle;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
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
    markFailed: (jobRunId, error, terminal) =>
      markJobRunFailed(db, jobRunId, error, terminal),
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
    const payload = job.data.payload;
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
            payload: payload ?? {},
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

    const handler = resolveHandler(handlers, name);
    if (!handler) {
      const message = `No handler registered for job "${name}"`;
      logger?.error?.({ jobRunId, name }, message);
      await lifecycle.markFailed(jobRunId, message, true);
      throw new UnrecoverableError(message);
    }

    await lifecycle.markActive(jobRunId, attempt);
    logger?.debug?.({ jobRunId, name, attempt }, "Job active");

    try {
      const result = await handler({
        jobRunId,
        name,
        tenantId,
        payload,
        attempt,
      });
      await lifecycle.markCompleted(jobRunId, result);
      logger?.info?.({ jobRunId, name, attempt }, "Job completed");
      return result;
    } catch (error) {
      const message = errorMessage(error);
      const maxAttempts = job.opts.attempts ?? DEFAULT_MAX_ATTEMPTS;
      const isUnrecoverable = error instanceof UnrecoverableError;
      const terminal = isUnrecoverable || attempt >= maxAttempts;

      logger?.error?.(
        {
          jobRunId,
          name,
          attempt,
          terminal,
          err: message,
        },
        "Job failed",
      );
      await lifecycle.markFailed(jobRunId, message, terminal);
      throw error;
    }
  };
}

export function startPlatformWorker(options: StartPlatformWorkerOptions): {
  close: () => Promise<void>;
} {
  const queueName = options.queueName ?? DEFAULT_QUEUE_NAME;
  const prefix = options.prefix ?? DEFAULT_REDIS_PREFIX;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const connection: Redis = createRedisConnection(options.redisUrl);

  const processorOptions: CreateJobProcessorOptions = {
    db: options.db,
    handlers: options.handlers,
  };
  if (options.logger !== undefined) {
    processorOptions.logger = options.logger;
  }

  const processJob = createJobProcessor(processorOptions);

  const worker = new Worker(queueName, processJob, {
    connection,
    prefix,
    concurrency,
  });

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
    async close() {
      await worker.close();
      await connection.quit();
    },
  };
}
