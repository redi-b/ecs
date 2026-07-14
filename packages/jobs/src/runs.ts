import { jobRuns } from "@ecs/db";
import { and, eq, sql } from "drizzle-orm";

import { DEFAULT_MAX_ATTEMPTS } from "./defaults.js";
import type { JobRunRecord, JobRunStatus, PlatformDb } from "./types.js";

export type JobRunRow = typeof jobRuns.$inferSelect;

export type InsertJobRunInput = {
  name: string;
  payload?: unknown;
  tenantId?: string | null;
  idempotencyKey?: string;
  maxAttempts?: number;
};

/**
 * Spec policy: when an idempotency key already maps to a row, reuse it
 * for every known status — never silently re-enqueue.
 */
export function shouldReuseExistingRun(status: JobRunStatus): boolean {
  switch (status) {
    case "queued":
    case "active":
    case "completed":
    case "failed":
    case "cancelled":
      return true;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function serializeJobRun(row: JobRunRow): JobRunRecord {
  return {
    id: row.id,
    tenantId: row.tenantId ?? null,
    name: row.name,
    status: row.status,
    payload: row.payload,
    result: row.result ?? null,
    error: row.error ?? null,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    idempotencyKey: row.idempotencyKey ?? null,
    bullmqJobId: row.bullmqJobId ?? null,
    queuedAt: row.queuedAt,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function insertJobRun(
  db: PlatformDb,
  input: InsertJobRunInput,
): Promise<JobRunRecord> {
  const now = new Date();
  const [row] = await db
    .insert(jobRuns)
    .values({
      name: input.name,
      payload: input.payload ?? {},
      tenantId: input.tenantId ?? null,
      idempotencyKey: input.idempotencyKey,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      status: "queued",
      queuedAt: now,
      updatedAt: now,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to insert job run");
  }

  return serializeJobRun(row);
}

export async function findJobRunByIdempotency(
  db: PlatformDb,
  name: string,
  key: string,
): Promise<JobRunRecord | null> {
  const [row] = await db
    .select()
    .from(jobRuns)
    .where(and(eq(jobRuns.name, name), eq(jobRuns.idempotencyKey, key)))
    .limit(1);

  return row ? serializeJobRun(row) : null;
}

export async function findJobRunById(
  db: PlatformDb,
  id: string,
): Promise<JobRunRecord | null> {
  const [row] = await db.select().from(jobRuns).where(eq(jobRuns.id, id)).limit(1);

  return row ? serializeJobRun(row) : null;
}

export async function markJobRunActive(
  db: PlatformDb,
  id: string,
  attempt: number,
): Promise<JobRunRecord | null> {
  const now = new Date();
  const [row] = await db
    .update(jobRuns)
    .set({
      status: "active",
      attempts: attempt,
      // Set startedAt only on the first transition (attempts was 0).
      startedAt: sql`CASE WHEN ${jobRuns.attempts} = 0 THEN ${now} ELSE ${jobRuns.startedAt} END`,
      updatedAt: now,
    })
    .where(eq(jobRuns.id, id))
    .returning();

  return row ? serializeJobRun(row) : null;
}

export async function markJobRunCompleted(
  db: PlatformDb,
  id: string,
  result: unknown,
): Promise<JobRunRecord | null> {
  const now = new Date();
  const [row] = await db
    .update(jobRuns)
    .set({
      status: "completed",
      result,
      finishedAt: now,
      updatedAt: now,
    })
    .where(eq(jobRuns.id, id))
    .returning();

  return row ? serializeJobRun(row) : null;
}

export async function markJobRunFailed(
  db: PlatformDb,
  id: string,
  error: string,
  terminal: boolean,
): Promise<JobRunRecord | null> {
  const now = new Date();
  const [row] = await db
    .update(jobRuns)
    .set({
      error,
      updatedAt: now,
      ...(terminal
        ? {
            status: "failed" as const,
            finishedAt: now,
          }
        : {}),
    })
    .where(eq(jobRuns.id, id))
    .returning();

  return row ? serializeJobRun(row) : null;
}

export async function setBullmqJobId(
  db: PlatformDb,
  id: string,
  bullmqJobId: string,
): Promise<JobRunRecord | null> {
  const now = new Date();
  const [row] = await db
    .update(jobRuns)
    .set({
      bullmqJobId,
      updatedAt: now,
    })
    .where(eq(jobRuns.id, id))
    .returning();

  return row ? serializeJobRun(row) : null;
}
