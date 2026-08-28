import type { createPlatformDb } from "@ecs/db";
import { jobRuns, mediaAssets, notificationLogs } from "@ecs/db";
import { and, count, desc, eq, inArray } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const SAFE_NOTIFICATION_CHANNELS = new Set(["email", "telegram"]);

export type SafeFailureCategory =
  | "authentication"
  | "configuration"
  | "network"
  | "rate_limit"
  | "timeout"
  | "validation"
  | "unknown";

export function classifyOperationalFailure(value: string | null): SafeFailureCategory {
  const error = value?.toLowerCase() ?? "";
  if (/unauthori[sz]ed|forbidden|authentication|credential|invalid[_ -]?key/.test(error)) {
    return "authentication";
  }
  if (/rate.?limit|too many requests|\b429\b/.test(error)) return "rate_limit";
  if (/timeout|timed out|deadline|abort/.test(error)) return "timeout";
  if (/network|dns|econn|enotfound|socket|fetch failed/.test(error)) return "network";
  if (/validation|invalid|malformed|unprocessable|\b400\b|\b422\b/.test(error)) {
    return "validation";
  }
  if (/config|missing|required|not set|unavailable/.test(error)) return "configuration";
  return "unknown";
}

function classifyJob(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("billing") || normalized.includes("invoice")) return "billing" as const;
  if (normalized.includes("analytics") || normalized.includes("metric")) {
    return "analytics" as const;
  }
  if (normalized.includes("notification") || normalized.includes("email")) {
    return "notification" as const;
  }
  if (normalized.includes("provision")) return "provisioning" as const;
  if (normalized.includes("sync") || normalized.includes("webhook")) return "integration" as const;
  return "other" as const;
}

export function createSuperadminDiagnosticsService(db: PlatformDb) {
  return async (input: { tenantId: string }) => {
    const [jobs, notifications, mediaCounts, recentMediaFailures] = await Promise.all([
      db
        .select({
          name: jobRuns.name,
          error: jobRuns.error,
          attempts: jobRuns.attempts,
          maxAttempts: jobRuns.maxAttempts,
          createdAt: jobRuns.createdAt,
          finishedAt: jobRuns.finishedAt,
        })
        .from(jobRuns)
        .where(and(eq(jobRuns.tenantId, input.tenantId), eq(jobRuns.status, "failed")))
        .orderBy(desc(jobRuns.createdAt))
        .limit(5),
      db
        .select({
          eventType: notificationLogs.eventType,
          channel: notificationLogs.channel,
          error: notificationLogs.error,
          createdAt: notificationLogs.createdAt,
        })
        .from(notificationLogs)
        .where(
          and(eq(notificationLogs.tenantId, input.tenantId), eq(notificationLogs.status, "failed")),
        )
        .orderBy(desc(notificationLogs.createdAt))
        .limit(5),
      db
        .select({ status: mediaAssets.status, total: count() })
        .from(mediaAssets)
        .where(eq(mediaAssets.tenantId, input.tenantId))
        .groupBy(mediaAssets.status),
      db
        .select({ createdAt: mediaAssets.createdAt })
        .from(mediaAssets)
        .where(
          and(eq(mediaAssets.tenantId, input.tenantId), inArray(mediaAssets.status, ["failed"])),
        )
        .orderBy(desc(mediaAssets.createdAt))
        .limit(5),
    ]);

    return buildSuperadminDiagnostics({ jobs, mediaCounts, notifications, recentMediaFailures });
  };
}

export function buildSuperadminDiagnostics(input: {
  jobs: Array<{
    name: string;
    error: string | null;
    attempts: number;
    maxAttempts: number;
    createdAt: Date;
    finishedAt: Date | null;
  }>;
  notifications: Array<{
    eventType: string;
    channel: string;
    error: string | null;
    createdAt: Date;
  }>;
  mediaCounts: Array<{ status: string; total: number }>;
  recentMediaFailures: Array<{ createdAt: Date }>;
}) {
  const media = Object.fromEntries(input.mediaCounts.map((row) => [row.status, row.total]));
  return {
    jobs: {
      recentFailures: input.jobs.map((job) => ({
        category: classifyJob(job.name),
        failureCategory: classifyOperationalFailure(job.error),
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        createdAt: job.createdAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() ?? null,
      })),
    },
    notifications: {
      recentFailures: input.notifications.map((notification) => ({
        channel: SAFE_NOTIFICATION_CHANNELS.has(notification.channel)
          ? notification.channel
          : "other",
        eventType: /^[a-z][a-z0-9_.-]{0,63}$/i.test(notification.eventType)
          ? notification.eventType
          : "other",
        failureCategory: classifyOperationalFailure(notification.error),
        createdAt: notification.createdAt.toISOString(),
      })),
    },
    media: {
      total: Object.values(media).reduce((sum, value) => sum + value, 0),
      pending: (media.pending ?? 0) + (media.processing ?? 0),
      ready: media.ready ?? 0,
      failed: media.failed ?? 0,
      recentFailures: input.recentMediaFailures.map((asset) => ({
        failureCategory: "unknown" as const,
        createdAt: asset.createdAt.toISOString(),
      })),
    },
  };
}
