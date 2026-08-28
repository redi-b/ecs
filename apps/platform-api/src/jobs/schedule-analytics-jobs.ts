import type { JobsClient } from "@ecs/jobs";

export const DEFAULT_ANALYTICS_ROLLUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_ANALYTICS_STARTUP_RETRY_MS = 30_000;

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function registerAnalyticsRepeatableJobs(options: {
  intervalMs?: number;
  isCommerceReady?: () => Promise<boolean>;
  jobsClient: JobsClient;
  now?: () => Date;
  signal?: AbortSignal;
  startupRetryMs?: number;
  waitForStartupRetry?: (delayMs: number, signal?: AbortSignal) => Promise<boolean>;
}) {
  const everyMs = options.intervalMs ?? DEFAULT_ANALYTICS_ROLLUP_INTERVAL_MS;
  if (!Number.isFinite(everyMs) || everyMs <= 0) {
    await options.jobsClient.removeRepeatableJob({
      everyMs: DEFAULT_ANALYTICS_ROLLUP_INTERVAL_MS,
      key: "analytics.commerce-rollup",
      name: "analytics.commerce-rollup",
    });
    return;
  }
  await options.jobsClient.scheduleRepeatableJob({
    everyMs,
    key: "analytics.commerce-rollup",
    name: "analytics.commerce-rollup",
    payload: { source: "bullmq_repeatable" },
  });
  while (options.isCommerceReady && !(await options.isCommerceReady())) {
    const shouldContinue = await (options.waitForStartupRetry ?? waitForRetry)(
      options.startupRetryMs ?? DEFAULT_ANALYTICS_STARTUP_RETRY_MS,
      options.signal,
    );
    if (!shouldContinue) return;
  }
  if (options.signal?.aborted) return;
  const now = options.now?.() ?? new Date();
  const startupWindow = Math.floor(now.getTime() / (15 * 60 * 1000));
  await options.jobsClient.enqueueJob({
    idempotencyKey: `analytics-commerce-rollup:startup:${startupWindow}`,
    name: "analytics.commerce-rollup",
    payload: { source: "worker_startup" },
  });
}
