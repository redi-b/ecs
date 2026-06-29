import type { createPlatformDb } from "@ecs/db";
import { notificationLogs, notificationPreferences } from "@ecs/db";
import { and, eq } from "drizzle-orm";

import type { NotificationEventRecordResult, NotificationEventType } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type NotificationPreferenceRow = typeof notificationPreferences.$inferSelect;

function eventMatchesPreference(events: unknown, eventType: NotificationEventType) {
  return Array.isArray(events) && (events.includes(eventType) || events.includes("*"));
}

function getMatchingPreferences(
  preferences: NotificationPreferenceRow[],
  eventType: NotificationEventType,
) {
  return preferences.filter((preference) => eventMatchesPreference(preference.events, eventType));
}

export function createNotificationService(db: PlatformDb) {
  return {
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
        };
      }

      await db.insert(notificationLogs).values(
        matchingPreferences.map((preference) => ({
          tenantId: input.tenantId,
          eventType: input.eventType,
          channel: preference.channel,
          recipient: preference.target,
          status: "pending" as const,
        })),
      );

      return {
        ok: true,
        logCount: matchingPreferences.length,
      };
    },
  };
}
