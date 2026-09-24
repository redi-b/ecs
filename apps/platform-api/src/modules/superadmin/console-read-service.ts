import type {
  OperatorAuditList,
  OperatorHealth,
  OperatorWorkList,
  PlatformOperatorList,
} from "@ecs/contracts";
import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  jobRuns,
  mediaAssets,
  notificationLogs,
  platformPermissionGrants,
  platformPrincipals,
  tenantProvisioningAttempts,
  tenants,
  users,
} from "@ecs/db";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNotNull,
  isNull,
  like,
  lt,
  max,
  notInArray,
  or,
} from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createSuperadminConsoleReadService(
  db: PlatformDb,
  options: {
    getDependencies?: () => Promise<OperatorHealth["dependencies"]>;
  } = {},
) {
  return {
    listWork: async (input: {
      kind?: "background_job" | "shop_setup";
      limit: number;
      offset: number;
    }): Promise<OperatorWorkList> => {
      if (input.kind === "background_job") {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);
        const condition = and(
          eq(jobRuns.status, "failed"),
          isNotNull(jobRuns.finishedAt),
          gte(jobRuns.finishedAt, since),
        );
        const rows = await db
          .select({
            id: jobRuns.id,
            jobName: jobRuns.name,
            attempts: jobRuns.attempts,
            maxAttempts: jobRuns.maxAttempts,
            error: jobRuns.error,
            finishedAt: jobRuns.finishedAt,
            merchantId: tenants.id,
            merchantName: tenants.name,
            merchantHandle: tenants.handle,
          })
          .from(jobRuns)
          .leftJoin(tenants, eq(jobRuns.tenantId, tenants.id))
          .where(condition)
          .orderBy(desc(jobRuns.finishedAt))
          .limit(input.limit)
          .offset(input.offset);
        const [total] = await db.select({ count: count() }).from(jobRuns).where(condition);
        return {
          kind: "background_job",
          items: rows.map((row) => {
            if (!row.finishedAt) throw new Error("failed_job_finished_at_missing");
            return {
              kind: "background_job" as const,
              id: row.id,
              jobName: row.jobName,
              merchant:
                row.merchantId && row.merchantName && row.merchantHandle
                  ? { id: row.merchantId, name: row.merchantName, handle: row.merchantHandle }
                  : null,
              attempts: row.attempts,
              maxAttempts: row.maxAttempts,
              failureCategory: classifyFailure(row.error),
              finishedAt: row.finishedAt.toISOString(),
            };
          }),
          count: total?.count ?? 0,
          limit: input.limit,
          offset: input.offset,
        };
      }
      const latest = await db
        .selectDistinctOn([tenantProvisioningAttempts.platformTenantId], {
          id: tenantProvisioningAttempts.id,
          handle: tenantProvisioningAttempts.handle,
          metadata: tenantProvisioningAttempts.metadata,
          status: tenantProvisioningAttempts.status,
          step: tenantProvisioningAttempts.step,
          error: tenantProvisioningAttempts.error,
          tenantId: tenantProvisioningAttempts.tenantId,
          createdAt: tenantProvisioningAttempts.createdAt,
        })
        .from(tenantProvisioningAttempts)
        .orderBy(
          tenantProvisioningAttempts.platformTenantId,
          desc(tenantProvisioningAttempts.createdAt),
        );
      const failed = latest
        .filter((attempt) => attempt.status === "failed")
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      return {
        kind: "shop_setup",
        items: failed.slice(input.offset, input.offset + input.limit).map((attempt) => ({
          kind: "shop_setup" as const,
          id: attempt.id,
          merchantName: getAttemptName(attempt.metadata, attempt.handle),
          handle: attempt.handle,
          step: attempt.step,
          failureCategory: classifyFailure(attempt.error),
          createdAt: attempt.createdAt.toISOString(),
          retryable: !attempt.tenantId,
        })),
        count: failed.length,
        limit: input.limit,
        offset: input.offset,
      };
    },

    listAudit: async (input: {
      action?: string;
      actor?: string;
      category?: "billing" | "merchant" | "provisioning" | "support";
      from?: Date;
      limit: number;
      merchant?: string;
      offset: number;
      outcome?: "accepted" | "completed" | "failed" | "unknown";
      resource?: string;
      to?: Date;
    }): Promise<OperatorAuditList> => {
      const categoryCondition = input.category
        ? getAuditCategoryCondition(input.category)
        : undefined;
      const actorPattern = input.actor ? `%${escapeLike(input.actor)}%` : undefined;
      const merchantPattern = input.merchant ? `%${escapeLike(input.merchant)}%` : undefined;
      const actionPattern = input.action ? `%${escapeLike(input.action)}%` : undefined;
      const resourcePattern = input.resource ? `%${escapeLike(input.resource)}%` : undefined;
      const condition = and(
        categoryCondition,
        actorPattern
          ? or(ilike(users.name, actorPattern), ilike(users.email, actorPattern))
          : undefined,
        merchantPattern
          ? or(ilike(tenants.name, merchantPattern), ilike(tenants.handle, merchantPattern))
          : undefined,
        actionPattern ? ilike(auditLogs.action, actionPattern) : undefined,
        resourcePattern
          ? or(
              ilike(auditLogs.targetType, resourcePattern),
              ilike(auditLogs.targetId, resourcePattern),
            )
          : undefined,
        input.outcome === "unknown"
          ? notInArray(auditLogs.outcome, ["accepted", "completed", "failed"])
          : input.outcome
            ? eq(auditLogs.outcome, input.outcome)
            : undefined,
        input.from ? gte(auditLogs.createdAt, input.from) : undefined,
        input.to ? lt(auditLogs.createdAt, input.to) : undefined,
      );
      const rows = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          correlationId: auditLogs.correlationId,
          outcome: auditLogs.outcome,
          actorId: users.id,
          actorName: users.name,
          actorEmail: users.email,
          merchantId: tenants.id,
          merchantName: tenants.name,
          merchantHandle: tenants.handle,
          targetType: auditLogs.targetType,
          targetId: auditLogs.targetId,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorUserId, users.id))
        .leftJoin(tenants, eq(auditLogs.tenantId, tenants.id))
        .where(condition)
        .orderBy(desc(auditLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      const [total] = await db
        .select({ count: count() })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorUserId, users.id))
        .leftJoin(tenants, eq(auditLogs.tenantId, tenants.id))
        .where(condition);
      return {
        events: rows.map((row) => ({
          id: row.id,
          action: row.action,
          correlationId: row.correlationId,
          outcome: normalizeAuditOutcome(row.outcome),
          actor:
            row.actorId && row.actorName && row.actorEmail
              ? { id: row.actorId, name: row.actorName, email: row.actorEmail }
              : null,
          merchant:
            row.merchantId && row.merchantName && row.merchantHandle
              ? { id: row.merchantId, name: row.merchantName, handle: row.merchantHandle }
              : null,
          targetType: row.targetType,
          targetId: row.targetId,
          createdAt: row.createdAt.toISOString(),
        })),
        count: total?.count ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
    },

    listOperators: async (input: { now?: Date } = {}): Promise<PlatformOperatorList> => {
      const now = input.now ?? new Date();
      const rows = await db
        .select({
          principalId: platformPrincipals.id,
          userId: users.id,
          name: users.name,
          email: users.email,
          status: platformPrincipals.status,
          permission: platformPermissionGrants.permission,
          permissionExpiresAt: platformPermissionGrants.expiresAt,
          createdAt: platformPrincipals.createdAt,
          updatedAt: platformPrincipals.updatedAt,
        })
        .from(platformPrincipals)
        .innerJoin(users, eq(platformPrincipals.userId, users.id))
        .leftJoin(
          platformPermissionGrants,
          and(
            eq(platformPermissionGrants.principalId, platformPrincipals.id),
            isNull(platformPermissionGrants.revokedAt),
            or(
              isNull(platformPermissionGrants.expiresAt),
              gt(platformPermissionGrants.expiresAt, now),
            ),
          ),
        )
        .orderBy(users.name, users.email);
      const operators = new Map<string, PlatformOperatorList["operators"][number]>();
      for (const row of rows) {
        const operator = operators.get(row.principalId) ?? {
          principalId: row.principalId,
          userId: row.userId,
          name: row.name,
          email: row.email,
          status: row.status,
          permissions: [],
          access: [],
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
        if (row.permission && !operator.permissions.includes(row.permission)) {
          operator.permissions.push(row.permission);
          operator.access.push({
            permission: row.permission,
            expiresAt: row.permissionExpiresAt?.toISOString() ?? null,
          });
        }
        operators.set(row.principalId, operator);
      }
      return { operators: [...operators.values()] };
    },

    getHealth: async (input: { now?: Date } = {}): Promise<OperatorHealth> => {
      const now = input.now ?? new Date();
      const dependenciesPromise = options.getDependencies?.() ?? Promise.resolve([]);
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
      const [
        dependencies,
        jobStatuses,
        recentJobFailures,
        jobTypeStatuses,
        jobTypeFailures,
        oldestQueued,
        notificationStatuses,
        recentNotificationFailures,
        notificationChannelStatuses,
        notificationChannelFailures,
        mediaStatuses,
        merchantStatuses,
      ] = await Promise.all([
        dependenciesPromise,
        db.select({ status: jobRuns.status, count: count() }).from(jobRuns).groupBy(jobRuns.status),
        db
          .select({ count: count() })
          .from(jobRuns)
          .where(and(eq(jobRuns.status, "failed"), gte(jobRuns.finishedAt, since))),
        db
          .select({
            name: jobRuns.name,
            status: jobRuns.status,
            count: count(),
            lastFinishedAt: max(jobRuns.finishedAt),
          })
          .from(jobRuns)
          .groupBy(jobRuns.name, jobRuns.status),
        db
          .select({ name: jobRuns.name, count: count() })
          .from(jobRuns)
          .where(and(eq(jobRuns.status, "failed"), gte(jobRuns.finishedAt, since)))
          .groupBy(jobRuns.name),
        db
          .select({ queuedAt: jobRuns.queuedAt })
          .from(jobRuns)
          .where(eq(jobRuns.status, "queued"))
          .orderBy(asc(jobRuns.queuedAt))
          .limit(1),
        db
          .select({ status: notificationLogs.status, count: count() })
          .from(notificationLogs)
          .groupBy(notificationLogs.status),
        db
          .select({ count: count() })
          .from(notificationLogs)
          .where(
            and(eq(notificationLogs.status, "failed"), gte(notificationLogs.createdAt, since)),
          ),
        db
          .select({
            channel: notificationLogs.channel,
            status: notificationLogs.status,
            count: count(),
            lastSentAt: max(notificationLogs.sentAt),
          })
          .from(notificationLogs)
          .groupBy(notificationLogs.channel, notificationLogs.status),
        db
          .select({ channel: notificationLogs.channel, count: count() })
          .from(notificationLogs)
          .where(and(eq(notificationLogs.status, "failed"), gte(notificationLogs.createdAt, since)))
          .groupBy(notificationLogs.channel),
        db
          .select({ status: mediaAssets.status, count: count() })
          .from(mediaAssets)
          .groupBy(mediaAssets.status),
        db.select({ status: tenants.status, count: count() }).from(tenants).groupBy(tenants.status),
      ]);
      const jobs = new Map(jobStatuses.map((row) => [row.status, row.count]));
      const notifications = new Map(notificationStatuses.map((row) => [row.status, row.count]));
      const merchants = new Map(merchantStatuses.map((row) => [row.status, row.count]));
      const media = new Map(mediaStatuses.map((row) => [row.status, row.count]));
      const failedJobs = recentJobFailures[0]?.count ?? 0;
      const failedNotifications = recentNotificationFailures[0]?.count ?? 0;
      const oldestQueuedAt = oldestQueued[0]?.queuedAt ?? null;
      const queueDelayed = oldestQueuedAt
        ? now.getTime() - oldestQueuedAt.getTime() > 10 * 60_000
        : false;
      const mediaFailed = media.get("failed") ?? 0;
      return {
        status:
          failedJobs ||
          failedNotifications ||
          queueDelayed ||
          mediaFailed ||
          dependencies.some((dependency) => dependency.status === "unavailable")
            ? "attention"
            : "clear",
        dependencies,
        backgroundWork: {
          queued: jobs.get("queued") ?? 0,
          active: jobs.get("active") ?? 0,
          failedLast24Hours: failedJobs,
          oldestQueuedAt: oldestQueuedAt?.toISOString() ?? null,
          types: buildJobTypeHealth(jobTypeStatuses, jobTypeFailures),
        },
        notifications: {
          pending: notifications.get("pending") ?? 0,
          retrying: notifications.get("retrying") ?? 0,
          failedLast24Hours: failedNotifications,
          channels: buildNotificationChannelHealth(
            notificationChannelStatuses,
            notificationChannelFailures,
          ),
        },
        media: {
          pending: media.get("pending") ?? 0,
          processing: media.get("processing") ?? 0,
          ready: media.get("ready") ?? 0,
          failed: mediaFailed,
        },
        merchants: {
          active: merchants.get("active") ?? 0,
          draft: merchants.get("draft") ?? 0,
          suspended: merchants.get("suspended") ?? 0,
          cancelled: merchants.get("cancelled") ?? 0,
        },
        generatedAt: now.toISOString(),
      };
    },
  };
}

export function buildJobTypeHealth(
  statuses: Array<{
    count: number;
    lastFinishedAt: Date | null;
    name: string;
    status: string;
  }>,
  failures: Array<{ count: number; name: string }>,
): OperatorHealth["backgroundWork"]["types"] {
  const failureCounts = new Map(failures.map((row) => [row.name, row.count]));
  const types = new Map<string, OperatorHealth["backgroundWork"]["types"][number]>();
  for (const row of statuses) {
    const item = types.get(row.name) ?? {
      name: row.name,
      queued: 0,
      active: 0,
      failedLast24Hours: failureCounts.get(row.name) ?? 0,
      lastCompletedAt: null,
    };
    if (row.status === "queued") item.queued = row.count;
    if (row.status === "active") item.active = row.count;
    if (row.status === "completed" && row.lastFinishedAt) {
      item.lastCompletedAt = row.lastFinishedAt.toISOString();
    }
    types.set(row.name, item);
  }
  return [...types.values()].sort(
    (left, right) =>
      right.failedLast24Hours - left.failedLast24Hours ||
      right.active - left.active ||
      right.queued - left.queued ||
      left.name.localeCompare(right.name),
  );
}

export function buildNotificationChannelHealth(
  statuses: Array<{
    channel: string;
    count: number;
    lastSentAt: Date | null;
    status: string;
  }>,
  failures: Array<{ channel: string; count: number }>,
): OperatorHealth["notifications"]["channels"] {
  const failureCounts = new Map(failures.map((row) => [row.channel, row.count]));
  const channels = new Map<string, OperatorHealth["notifications"]["channels"][number]>();
  for (const row of statuses) {
    const item = channels.get(row.channel) ?? {
      channel: row.channel,
      pending: 0,
      retrying: 0,
      failedLast24Hours: failureCounts.get(row.channel) ?? 0,
      lastSentAt: null,
    };
    if (row.status === "pending") item.pending = row.count;
    if (row.status === "retrying") item.retrying = row.count;
    if (row.status === "sent" && row.lastSentAt) item.lastSentAt = row.lastSentAt.toISOString();
    channels.set(row.channel, item);
  }
  return [...channels.values()].sort(
    (left, right) =>
      right.failedLast24Hours - left.failedLast24Hours ||
      right.retrying - left.retrying ||
      right.pending - left.pending ||
      left.channel.localeCompare(right.channel),
  );
}

function getAuditCategoryCondition(category: "billing" | "merchant" | "provisioning" | "support") {
  if (category === "billing") {
    return or(
      like(auditLogs.action, "billing.%"),
      like(auditLogs.action, "entitlement.%"),
      like(auditLogs.action, "payment_credentials.%"),
      like(auditLogs.action, "payment_onboarding.%"),
    );
  }
  if (category === "provisioning") {
    return or(like(auditLogs.action, "provisioning.%"), like(auditLogs.action, "shop.provisioned"));
  }
  return like(auditLogs.action, `${category === "merchant" ? "tenant" : category}.%`);
}

function escapeLike(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replace(/\s+/g, "%");
}

export function normalizeAuditOutcome(
  value: string,
): OperatorAuditList["events"][number]["outcome"] {
  return value === "accepted" || value === "completed" || value === "failed" ? value : "unknown";
}

function getAttemptName(metadata: unknown, handle: string) {
  if (metadata && typeof metadata === "object" && "name" in metadata) {
    const name = Reflect.get(metadata, "name");
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return handle;
}

function classifyFailure(
  value: string | null,
): OperatorWorkList["items"][number]["failureCategory"] {
  const normalized = value?.toLowerCase() ?? "";
  if (/unauthor|forbidden|credential|auth/.test(normalized)) return "authentication";
  if (/config|missing|not configured|unavailable/.test(normalized)) return "configuration";
  if (/rate.?limit|too many/.test(normalized)) return "rate_limit";
  if (/timeout|timed out/.test(normalized)) return "timeout";
  if (/network|connect|fetch|dns/.test(normalized)) return "network";
  if (/invalid|validation|rejected/.test(normalized)) return "validation";
  return "unknown";
}
