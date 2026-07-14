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
  markJobRunActive,
  markJobRunCompleted,
  markJobRunFailed,
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
  jobRunId: string;
  tenantId: string | null;
  payload: unknown;
};

/** Minimal job surface used by the processor so tests can inject fakes. */
export type PlatformWorkerJob = {
  name: string;
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
    const { jobRunId, payload } = job.data;
    const tenantId = job.data.tenantId ?? null;
    const attempt = job.attemptsMade + 1;

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
