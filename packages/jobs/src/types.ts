import type { createPlatformDb } from "@ecs/db";

export type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type JobRunStatus = "queued" | "active" | "completed" | "failed" | "cancelled";

export type JobHandlerContext<TPayload = unknown> = {
  jobRunId: string;
  name: string;
  tenantId: string | null;
  payload: TPayload;
  attempt: number;
  signal: AbortSignal;
};

export type JobHandler<TPayload = unknown> = (ctx: JobHandlerContext<TPayload>) => Promise<unknown>;

export type EnqueueJobInput = {
  name: string;
  payload?: unknown;
  tenantId?: string | null;
  idempotencyKey?: string;
  maxAttempts?: number;
};

export type EnqueueJobResult = {
  jobRunId: string;
  name: string;
  status: JobRunStatus;
  reused: boolean;
};

export type JobRunRecord = {
  id: string;
  tenantId: string | null;
  name: string;
  status: JobRunStatus;
  payload: unknown;
  result: unknown;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  idempotencyKey: string | null;
  bullmqJobId: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type JobQueueHealth = {
  queue: "bulk" | "critical" | "default";
  counts: {
    active: number;
    delayed: number;
    failed: number;
    paused: number;
    prioritized: number;
    waiting: number;
  };
  oldestWaitingAt: Date | null;
  workers: Array<{
    buildVersion: string;
    lastSeenAt: Date;
    workerId: string;
  }>;
};

export type JobSchedulerHealth = {
  buildVersion: string;
  lastSeenAt: Date;
} | null;

export type JobRunSummary = Omit<
  JobRunRecord,
  "error" | "idempotencyKey" | "payload" | "result"
> & {
  canCancel: boolean;
  canRetry: boolean;
  errorCode: string | null;
};

export type JobControlResult =
  | { ok: true; run: JobRunSummary }
  | {
      error: "job_not_found" | "job_not_retryable" | "job_not_cancellable" | "job_state_changed";
      ok: false;
    };
