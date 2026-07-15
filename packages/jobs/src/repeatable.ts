import type { Queue } from "bullmq";

import { DEFAULT_BACKOFF_MS, DEFAULT_MAX_ATTEMPTS } from "./defaults.js";

export type ScheduleRepeatableJobInput = {
  /** Job name (must match a worker handler). */
  name: string;
  /** Interval in milliseconds. Must be > 0. */
  everyMs: number;
  /** Stable BullMQ repeat key for upsert/remove. Defaults to job name. */
  key?: string;
  payload?: unknown;
  maxAttempts?: number;
};

export type ScheduleRepeatableJobResult = {
  name: string;
  key: string;
  everyMs: number;
};

export type RemoveRepeatableJobInput = {
  name: string;
  /** Must match the key used when scheduling. Defaults to name. */
  key?: string;
  everyMs: number;
};

/**
 * Register (or refresh) a BullMQ repeatable job.
 *
 * Payload uses `jobRunId: null` so the worker creates a fresh `job_runs` row
 * on each fire (repeatables cannot pre-insert one row per occurrence).
 */
export async function scheduleRepeatableJobOnQueue(
  queue: Queue,
  input: ScheduleRepeatableJobInput,
): Promise<ScheduleRepeatableJobResult> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Job name must be non-empty");
  }
  if (!Number.isFinite(input.everyMs) || input.everyMs <= 0) {
    throw new Error("everyMs must be a positive number");
  }

  const key = (input.key ?? name).trim() || name;
  const everyMs = Math.floor(input.everyMs);

  // Upsert: drop any existing definition with this key/name, then re-add.
  await removeRepeatableJobOnQueue(queue, { name, key, everyMs });

  // Also remove other keys for the same job name (legacy setInterval enqueues / old keys).
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    if (job.name === name && job.key !== key) {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  await queue.add(
    name,
    {
      jobRunId: null,
      tenantId: null,
      payload: input.payload ?? { source: "bullmq_repeatable", key },
    },
    {
      repeat: {
        every: everyMs,
        key,
      },
      attempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: DEFAULT_BACKOFF_MS,
      },
      // Avoid filling Redis with completed repeat instances forever.
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  );

  return { name, key, everyMs };
}

export async function removeRepeatableJobOnQueue(
  queue: Queue,
  input: RemoveRepeatableJobInput,
): Promise<boolean> {
  const name = input.name.trim();
  const key = (input.key ?? name).trim() || name;
  const everyMs = Math.floor(input.everyMs);

  // Preferred: remove by exact repeat pattern.
  try {
    const removed = await queue.removeRepeatable(name, { every: everyMs, key });
    if (removed) return true;
  } catch {
    // Fall through to key scan.
  }

  const existing = await queue.getRepeatableJobs();
  let any = false;
  for (const job of existing) {
    if (job.name === name && (job.key === key || job.id === key)) {
      await queue.removeRepeatableByKey(job.key);
      any = true;
    }
  }
  return any;
}
