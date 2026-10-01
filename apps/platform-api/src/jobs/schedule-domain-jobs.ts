import type { JobRepeatableScheduler } from "@ecs/jobs";

export const DOMAIN_SCAN_INTERVAL_MS = 60_000;

export async function registerDomainRepeatableJobs(options: {
  jobsClient: JobRepeatableScheduler;
  // Configuration and enablement differ: configured-but-disabled still scans
  // to withdraw routes. Unconfigured workers cannot operate the route provider.
  configured: boolean;
  now?: () => number;
}) {
  const schedule = { name: "domains.scan", key: "domains.scan", everyMs: DOMAIN_SCAN_INTERVAL_MS };
  if (!options.configured) {
    await options.jobsClient.removeRepeatableJob(schedule);
    return;
  }
  await options.jobsClient.scheduleRepeatableJob({
    ...schedule,
    payload: { source: "bullmq_repeatable" },
  });
  await options.jobsClient.enqueueJob({
    name: "domains.scan",
    payload: { source: "bullmq_repeatable" },
    idempotencyKey: `domains:startup:${Math.floor((options.now ?? Date.now)() / DOMAIN_SCAN_INTERVAL_MS)}`,
  });
}
