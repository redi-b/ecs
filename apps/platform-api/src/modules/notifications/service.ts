import type { createPlatformDb } from "@ecs/db";
import { auditLogs, notificationLogs, notificationPreferences } from "@ecs/db";
import type { EnqueueJobInput, EnqueueJobResult } from "@ecs/jobs";
import { and, eq } from "drizzle-orm";

import type {
  NotificationChannel,
  NotificationEventRecordResult,
  NotificationEventType,
  NotificationPreference,
  NotificationPreferenceListResult,
  NotificationPreferenceUpsertResult,
} from "../../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type NotificationPreferenceRow = typeof notificationPreferences.$inferSelect;

export type NotificationServiceEnqueue = (
  input: EnqueueJobInput,
) => Promise<EnqueueJobResult>;

export type CreateNotificationServiceOptions = {
  /** When omitted, logs stay pending (tests / no-worker harness). */
  enqueueJob?: NotificationServiceEnqueue;
};

const allowedChannels = new Set<NotificationChannel>(["email", "telegram"]);
const allowedEvents = new Set<NotificationEventType>([
  "cod_order.created",
  "chapa.onboarding_needs_review",
  "domain.misconfigured",
  "notification.test",
  "order.created",
  "order.cancelled",
  "order.confirmed",
  "order.delivered",
  "order.out_for_delivery",
  "order.ready",
  "payment.paid",
  "payment.failed",
  "payment.webhook_failed",
  "shop.provisioning_failed",
  "shop.published",
  "shop.suspended",
]);

export function isAllowedNotificationEventType(eventType: string): eventType is NotificationEventType {
  return allowedEvents.has(eventType as NotificationEventType);
}

function eventMatchesPreference(events: unknown, eventType: NotificationEventType) {
  return Array.isArray(events) && (events.includes(eventType) || events.includes("*"));
}

function getMatchingPreferences(
  preferences: NotificationPreferenceRow[],
  eventType: NotificationEventType,
) {
  return preferences.filter((preference) => eventMatchesPreference(preference.events, eventType));
}

function serializeNotificationPreference(
  preference: NotificationPreferenceRow,
): NotificationPreference {
  return {
    id: preference.id,
    channel: preference.channel,
    enabled: preference.enabled,
    events: Array.isArray(preference.events)
      ? preference.events.filter((event): event is string => typeof event === "string")
      : [],
    target: preference.target,
    updatedAt: preference.updatedAt.toISOString(),
  };
}

function normalizeChannel(channel: string) {
  return channel.trim().toLowerCase();
}

function normalizeEvents(events: string[]) {
  return [...new Set(events.map((event) => event.trim()).filter(Boolean))];
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function createNotificationService(
  db: PlatformDb,
  options: CreateNotificationServiceOptions = {},
) {
  const enqueueJob = options.enqueueJob;

  return {
    listNotificationPreferences: async (input: {
      tenantId: string;
    }): Promise<NotificationPreferenceListResult> => {
      const preferences = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.tenantId, input.tenantId));

      return {
        ok: true,
        preferences: preferences.map(serializeNotificationPreference),
      };
    },
    recordNotificationEvent: async (input: {
      eventType: NotificationEventType;
      payload?: unknown;
      tenantId: string;
    }): Promise<NotificationEventRecordResult> => {
      const preferences = await db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.tenantId, input.tenantId),
            eq(notificationPreferences.enabled, true),
          ),
        );

      const matchingPreferences = getMatchingPreferences(preferences, input.eventType);

      if (matchingPreferences.length === 0) {
        return {
          ok: true,
          logCount: 0,
          logIds: [],
        };
      }

      const payload =
        input.payload !== undefined && input.payload !== null && typeof input.payload === "object"
          ? input.payload
          : {};

      const inserted = await db
        .insert(notificationLogs)
        .values(
          matchingPreferences.map((preference) => ({
            tenantId: input.tenantId,
            eventType: input.eventType,
            channel: preference.channel,
            recipient: preference.target,
            status: "pending" as const,
            payload,
          })),
        )
        .returning({ id: notificationLogs.id });

      const logIds = inserted.map((row) => row.id);

      if (enqueueJob) {
        for (const logId of logIds) {
          try {
            await enqueueJob({
              name: "notifications.deliver",
              payload: { notificationLogId: logId },
              tenantId: input.tenantId,
              idempotencyKey: `notifications.deliver:${logId}`,
            });
          } catch (error) {
            await db
              .update(notificationLogs)
              .set({
                status: "failed",
                error: `enqueue_failed:${errorMessage(error)}`,
              })
              .where(eq(notificationLogs.id, logId));
          }
        }
      }

      return {
        ok: true,
        logCount: logIds.length,
        logIds,
      };
    },
    /**
     * Send a test notification for one channel (uses log provider until real channels ship).
     * Does not require notification.test in preference events — creates a delivery attempt directly.
     */
    sendTestNotification: async (input: {
      channel: string;
      tenantId: string;
    }): Promise<
      | { ok: true; logId: string; jobEnqueued: boolean }
      | {
          ok: false;
          error: "notification_channel_invalid" | "notification_preference_missing";
          status: 400 | 404;
        }
    > => {
      const channel = normalizeChannel(input.channel);
      if (!allowedChannels.has(channel as NotificationChannel)) {
        return { ok: false, error: "notification_channel_invalid", status: 400 };
      }

      const [preference] = await db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.tenantId, input.tenantId),
            eq(notificationPreferences.channel, channel),
            eq(notificationPreferences.enabled, true),
          ),
        )
        .limit(1);

      if (!preference) {
        return { ok: false, error: "notification_preference_missing", status: 404 };
      }

      const [log] = await db
        .insert(notificationLogs)
        .values({
          tenantId: input.tenantId,
          eventType: "notification.test",
          channel: preference.channel,
          recipient: preference.target,
          status: "pending",
          payload: {
            source: "dashboard_test",
            channel,
          },
        })
        .returning({ id: notificationLogs.id });

      if (!log) {
        throw new Error("Failed to create test notification log");
      }

      let jobEnqueued = false;
      if (enqueueJob) {
        try {
          await enqueueJob({
            name: "notifications.deliver",
            payload: { notificationLogId: log.id },
            tenantId: input.tenantId,
            idempotencyKey: `notifications.deliver:${log.id}`,
          });
          jobEnqueued = true;
        } catch (error) {
          await db
            .update(notificationLogs)
            .set({
              status: "failed",
              error: `enqueue_failed:${errorMessage(error)}`,
            })
            .where(eq(notificationLogs.id, log.id));
        }
      }

      return { ok: true, logId: log.id, jobEnqueued };
    },
    upsertNotificationPreference: async (input: {
      channel: string;
      enabled: boolean;
      events: string[];
      target: string;
      tenantId: string;
      userId: string;
    }): Promise<NotificationPreferenceUpsertResult> => {
      const channel = normalizeChannel(input.channel);
      const events = normalizeEvents(input.events);
      const target = input.target.trim();

      if (!allowedChannels.has(channel as NotificationChannel)) {
        return {
          ok: false,
          error: "notification_channel_invalid",
          status: 400,
        };
      }

      if (!target) {
        return {
          ok: false,
          error: "notification_target_invalid",
          status: 400,
        };
      }

      if (
        events.length === 0 ||
        events.some((event) => !allowedEvents.has(event as NotificationEventType))
      ) {
        return {
          ok: false,
          error: "notification_events_invalid",
          status: 400,
        };
      }

      const preference = await db.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: notificationPreferences.id })
          .from(notificationPreferences)
          .where(
            and(
              eq(notificationPreferences.tenantId, input.tenantId),
              eq(notificationPreferences.channel, channel),
              eq(notificationPreferences.target, target),
            ),
          )
          .limit(1);

        const [writtenPreference] = existing
          ? await transaction
              .update(notificationPreferences)
              .set({
                enabled: input.enabled,
                events,
                updatedAt: new Date(),
              })
              .where(eq(notificationPreferences.id, existing.id))
              .returning()
          : await transaction
              .insert(notificationPreferences)
              .values({
                tenantId: input.tenantId,
                channel,
                enabled: input.enabled,
                events,
                target,
              })
              .returning();

        if (!writtenPreference) {
          throw new Error("Notification preference write returned no rows.");
        }

        await transaction.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "notification.preference_upserted",
          targetType: "notification_preference",
          targetId: writtenPreference.id,
          metadata: {
            channel,
            enabled: input.enabled,
            events,
            target,
          },
        });

        return writtenPreference;
      });

      return {
        ok: true,
        preference: serializeNotificationPreference(preference),
      };
    },
  };
}
