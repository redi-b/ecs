/** Re-export for job handlers that must fail without retry (no direct bullmq imports in apps). */
export { UnrecoverableError } from "bullmq";
export type { JobsClient, JobsClientOptions } from "./client.js";
export { createJobsClient } from "./client.js";
export {
  DEFAULT_BACKOFF_MS,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_QUEUE_NAME,
  DEFAULT_REDIS_PREFIX,
} from "./defaults.js";
export type {
  ReconciliationJobState,
  ReconciliationQueue,
  ReconciliationStore,
  ReconciliationSummary,
} from "./reconcile.js";
export { reconcileQueuedJobs } from "./reconcile.js";
export type {
  JobBackoffPolicy,
  JobDefinition,
  JobQueueClass,
  JobRegistry,
  JobRetentionPolicy,
  JobRetryClassification,
} from "./registry.js";
export {
  createJobRegistry,
  defineJob,
  InvalidJobPayloadError,
  InvalidJobResultError,
  UnknownJobDefinitionError,
} from "./registry.js";
export type {
  RemoveRepeatableJobInput,
  ScheduleRepeatableJobInput,
  ScheduleRepeatableJobResult,
} from "./repeatable.js";
export {
  removeRepeatableJobOnQueue,
  scheduleRepeatableJobOnQueue,
} from "./repeatable.js";
export type {
  ShutdownLogger,
  ShutdownOutcome,
  ShutdownStep,
} from "./shutdown.js";
export { createShutdownController, parseShutdownDeadlineMs } from "./shutdown.js";
export type {
  EnqueueJobInput,
  EnqueueJobResult,
  JobControlResult,
  JobHandler,
  JobHandlerContext,
  JobQueueHealth,
  JobRunRecord,
  JobRunStatus,
  JobRunSummary,
  JobSchedulerHealth,
  PlatformDb,
} from "./types.js";
export type { StartPlatformWorkerOptions } from "./worker.js";
export { startPlatformWorker, startPlatformWorkers } from "./worker.js";
