import { Queue } from "bullmq";
import type { Redis } from "ioredis";

import { createRedisConnection } from "./connection.js";
import {
  DEFAULT_BACKOFF_MS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_QUEUE_NAME,
  DEFAULT_REDIS_PREFIX,
} from "./defaults.js";
import {
  findJobRunById,
  findJobRunByIdempotency,
  insertJobRun,
  markJobRunFailed,
  setBullmqJobId,
  shouldReuseExistingRun,
  type InsertJobRunInput,
} from "./runs.js";
import type {
  EnqueueJobInput,
  EnqueueJobResult,
  JobRunRecord,
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
};

/** Minimal queue surface used by enqueue so tests can inject a fake. */
export type JobsQueueLike = {
  add(
    name: string,
    data: {
      jobRunId: string;
      tenantId: string | null;
      payload: unknown;
    },
    opts: {
      jobId: string;
      attempts: number;
      backoff: { type: "exponential"; delay: number };
    },
  ): Promise<{ id?: string | null | undefined }>;
};

export type JobsClient = {
  enqueueJob(input: EnqueueJobInput): Promise<EnqueueJobResult>;
  getJobRun(id: string): Promise<JobRunRecord | null>;
  close(): Promise<void>;
};

export type EnqueueWithQueueOptions = {
  db: PlatformDb;
  queue: JobsQueueLike;
  input: EnqueueJobInput;
  logger?: JobsLogger;
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
  const { db, queue, input, logger } = options;
  const name = assertValidJobName(input.name);

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

  const run = await insertJobRun(db, buildInsertInput(name, input));
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

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
          type: "exponential",
          delay: DEFAULT_BACKOFF_MS,
        },
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
    await markJobRunFailed(db, run.id, message, true);
    throw error;
  }
}

export function createJobsClient(options: JobsClientOptions): JobsClient {
  const queueName = options.queueName ?? DEFAULT_QUEUE_NAME;
  const prefix = options.prefix ?? DEFAULT_REDIS_PREFIX;
  const connection: Redis = createRedisConnection(options.redisUrl);
  const queue = new Queue(queueName, {
    connection,
    prefix,
  });

  return {
    enqueueJob(input) {
      const enqueueOptions: EnqueueWithQueueOptions = {
        db: options.db,
        queue,
        input,
      };
      if (options.logger !== undefined) {
        enqueueOptions.logger = options.logger;
      }
      return enqueueWithQueue(enqueueOptions);
    },
    getJobRun(id) {
      return findJobRunById(options.db, id);
    },
    async close() {
      await queue.close();
      await connection.quit();
    },
  };
}
