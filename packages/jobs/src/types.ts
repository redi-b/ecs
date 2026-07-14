import type { createPlatformDb } from "@ecs/db";

export type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type JobRunStatus = "queued" | "active" | "completed" | "failed" | "cancelled";

export type JobHandlerContext<TPayload = unknown> = {
  jobRunId: string;
  name: string;
  tenantId: string | null;
  payload: TPayload;
  attempt: number;
};

export type JobHandler<TPayload = unknown> = (
  ctx: JobHandlerContext<TPayload>,
) => Promise<unknown>;

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
