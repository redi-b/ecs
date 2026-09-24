import type { createJobsClient } from "@ecs/jobs";
import type { createLogger } from "@ecs/logger";
import {
  DEFAULT_ANALYTICS_ROLLUP_INTERVAL_MS,
  registerAnalyticsRepeatableJobs,
} from "../jobs/schedule-analytics-jobs.js";
import {
  parseBillingIntervalMs,
  registerBillingRepeatableJobs,
} from "../jobs/schedule-billing-jobs.js";
import type { createNotificationService } from "../modules/notifications/service.js";

type WorkerSchedulingOptions = {
  buildVersion: string;
  env: NodeJS.ProcessEnv;
  jobsClient: ReturnType<typeof createJobsClient>;
  logger: ReturnType<typeof createLogger>;
  medusaInternalUrl: string;
  notificationService: ReturnType<typeof createNotificationService>;
};

export function startWorkerScheduling(options: WorkerSchedulingOptions) {
  void registerBillingRepeatableJobs({
    jobsClient: options.jobsClient,
    logger: options.logger,
    reconcileIntervalMs: parseBillingIntervalMs(
      options.env.BILLING_RECONCILE_INTERVAL_MS,
      5 * 60 * 1000,
    ),
    lifecycleIntervalMs: parseBillingIntervalMs(
      options.env.BILLING_LIFECYCLE_INTERVAL_MS,
      60 * 60 * 1000,
    ),
  }).catch((error) => {
    options.logger.warn(
      { err: error instanceof Error ? error.message : String(error) },
      "failed to register billing BullMQ repeatables",
    );
  });

  const analyticsStartupController = new AbortController();
  const reconciliationIntervalMs = Math.max(
    5_000,
    Number.parseInt(options.env.JOB_RECONCILE_INTERVAL_MS ?? "30000", 10) || 30_000,
  );

  const recoverInboxEvents = async () => {
    const events = await options.notificationService.inbox.listRecoverableEvents(100);
    let queued = 0;
    let failed = 0;
    for (const event of events) {
      try {
        await options.jobsClient.enqueueJob({
          idempotencyKey: `notifications.in-app.materialize:${event.id}:${event.attempts}`,
          name: "notifications.in-app.materialize",
          payload: { eventId: event.id },
          tenantId: event.tenantId,
        });
        queued += 1;
      } catch {
        failed += 1;
      }
    }
    if (queued || failed) {
      options.logger.info({ failed, queued }, "Inbox event recovery scan completed");
    }
  };

  const reconcileQueued = () =>
    options.jobsClient.reconcileQueued().then(async (summary) => {
      await recoverInboxEvents();
      await options.jobsClient.recordSchedulerHeartbeat({
        buildVersion: options.buildVersion,
        ttlMs: reconciliationIntervalMs * 3,
      });
      if (summary.recovered || summary.rejected) {
        options.logger.info(summary, "Queued job reconciliation completed");
      }
    });

  const reportFailure = (message: string) => (error: unknown) => {
    options.logger.warn({ err: error instanceof Error ? error.message : String(error) }, message);
  };

  void reconcileQueued().catch(reportFailure("Queued job reconciliation failed"));
  const reconciliationTimer = setInterval(() => {
    void reconcileQueued().catch(reportFailure("Queued job reconciliation failed"));
  }, reconciliationIntervalMs);
  reconciliationTimer.unref();

  const retentionIntervalMs = Math.max(
    60_000,
    Number.parseInt(options.env.JOB_RETENTION_INTERVAL_MS ?? "3600000", 10) || 3_600_000,
  );
  const cleanupExpiredRuns = () =>
    Promise.all([
      options.jobsClient.cleanupExpiredRuns(),
      options.notificationService.inbox.deleteExpired(),
    ]).then(([jobs, inbox]) => {
      if (jobs.deleted) {
        options.logger.info({ deleted: jobs.deleted }, "Expired job records removed");
      }
      if (inbox.deleted) {
        options.logger.info({ deleted: inbox.deleted }, "Expired inbox items removed");
      }
    });

  void cleanupExpiredRuns().catch(reportFailure("Job record retention cleanup failed"));
  const retentionTimer = setInterval(() => {
    void cleanupExpiredRuns().catch(reportFailure("Job record retention cleanup failed"));
  }, retentionIntervalMs);
  retentionTimer.unref();

  void registerAnalyticsRepeatableJobs({
    jobsClient: options.jobsClient,
    isCommerceReady: async () => {
      const response = await fetch(new URL("/health", options.medusaInternalUrl), {
        signal: AbortSignal.timeout(1_000),
      }).catch(() => null);
      return response?.ok ?? false;
    },
    intervalMs: parseBillingIntervalMs(
      options.env.ANALYTICS_ROLLUP_INTERVAL_MS,
      DEFAULT_ANALYTICS_ROLLUP_INTERVAL_MS,
    ),
    signal: analyticsStartupController.signal,
  }).catch(reportFailure("failed to register analytics BullMQ repeatable"));

  return {
    stop() {
      analyticsStartupController.abort();
      clearInterval(reconciliationTimer);
      clearInterval(retentionTimer);
    },
  };
}
