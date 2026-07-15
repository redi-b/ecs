import type { JobsClient } from "@ecs/jobs";

type ScheduleLogger = {
  info?: (obj: Record<string, unknown>, msg?: string) => void;
  warn?: (obj: Record<string, unknown>, msg?: string) => void;
};

/**
 * Register BullMQ repeatable jobs for billing maintenance.
 * Replaces process-local setInterval — Redis/BullMQ owns the schedule so it
 * survives worker restarts and is visible via getRepeatableJobs.
 */
export async function registerBillingRepeatableJobs(options: {
  jobsClient: JobsClient;
  logger?: ScheduleLogger;
  /** Default 5 minutes. Set 0 or negative to remove/disable. */
  reconcileIntervalMs?: number;
  /** Default 1 hour. Set 0 or negative to remove/disable. */
  lifecycleIntervalMs?: number;
}): Promise<void> {
  await upsertOrRemove(options, {
    name: "billing.reconcile-payments",
    everyMs: options.reconcileIntervalMs ?? 5 * 60 * 1000,
  });
  await upsertOrRemove(options, {
    name: "billing.lifecycle",
    everyMs: options.lifecycleIntervalMs ?? 60 * 60 * 1000,
  });
}

async function upsertOrRemove(
  options: {
    jobsClient: JobsClient;
    logger?: ScheduleLogger;
  },
  job: { name: string; everyMs: number },
) {
  const everyMs = job.everyMs;

  if (!Number.isFinite(everyMs) || everyMs <= 0) {
    // Best-effort cleanup of known defaults so disabling env actually sticks.
    for (const candidate of [
      everyMs,
      5 * 60 * 1000,
      60 * 60 * 1000,
      300_000,
      3_600_000,
    ]) {
      if (candidate > 0) {
        try {
          await options.jobsClient.removeRepeatableJob({
            name: job.name,
            key: job.name,
            everyMs: candidate,
          });
        } catch {
          // ignore
        }
      }
    }
    options.logger?.info?.(
      { name: job.name, everyMs },
      "billing BullMQ repeatable disabled/removed",
    );
    return;
  }

  try {
    const result = await options.jobsClient.scheduleRepeatableJob({
      name: job.name,
      everyMs,
      key: job.name,
      payload: { source: "bullmq_repeatable" },
    });
    options.logger?.info?.(
      { name: result.name, key: result.key, everyMs: result.everyMs },
      "billing BullMQ repeatable registered",
    );
  } catch (error) {
    options.logger?.warn?.(
      {
        name: job.name,
        everyMs,
        err: error instanceof Error ? error.message : String(error),
      },
      "billing BullMQ repeatable registration failed",
    );
  }
}

export function parseBillingIntervalMs(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}
