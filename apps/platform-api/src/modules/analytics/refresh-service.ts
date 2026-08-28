import type { EnqueueJobInput, EnqueueJobResult } from "@ecs/jobs";

export const INSIGHTS_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;

type EnqueueJob = (input: EnqueueJobInput) => Promise<EnqueueJobResult>;

export function createInsightsRefreshService(options: {
  enqueueJob: EnqueueJob;
  now?: () => Date;
}) {
  const now = options.now ?? (() => new Date());

  return async (input: { tenantId: string }) => {
    const requestedAt = now();
    const window = Math.floor(requestedAt.getTime() / INSIGHTS_REFRESH_COOLDOWN_MS);
    const retryAt = new Date((window + 1) * INSIGHTS_REFRESH_COOLDOWN_MS);
    const job = await options.enqueueJob({
      idempotencyKey: `merchant-insights-refresh:${input.tenantId}:${window}`,
      name: "analytics.commerce-rollup",
      payload: { source: "merchant" },
      tenantId: input.tenantId,
    });

    return {
      jobId: job.jobRunId,
      queued: !job.reused,
      requestedAt: requestedAt.toISOString(),
      retryAt: retryAt.toISOString(),
      status: job.status,
    };
  };
}
