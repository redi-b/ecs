import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  notificationDestinations,
  notificationLogs,
  notificationPreferences,
  tenants,
} from "@ecs/db";
import type { EnqueueJobInput, EnqueueJobResult } from "@ecs/jobs";
import { and, eq, gte, ne, or, sql } from "drizzle-orm";

import type {
  NotificationChannel,
  NotificationEventRecordResult,
  NotificationEventType,
  NotificationPreference,
  NotificationPreferenceListResult,
  NotificationPreferenceUpsertResult,
} from "../../types/index.js";
import { createInAppNotificationService } from "./inbox.js";

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
  // Legacy alias still accepted on record, then canonicalized to order.created.
  "cod_order.created",
  "billing.invoice_ready",
  "billing.past_due",
  "chapa.onboarding_needs_review",
  "domain.misconfigured",
  "inventory.low",
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

/** Map deprecated event ids to the canonical type used for delivery + prefs. */
export function canonicalizeNotificationEventType(
  eventType: string,
): NotificationEventType | string {
  if (eventType === "cod_order.created") {
    return "order.created";
  }
  return eventType;
}

export function isAllowedNotificationEventType(eventType: string): eventType is NotificationEventType {
  const canonical = canonicalizeNotificationEventType(eventType);
  return allowedEvents.has(canonical as NotificationEventType) || allowedEvents.has(eventType as NotificationEventType);
}

function eventMatchesPreference(events: unknown, eventType: NotificationEventType) {
  if (!Array.isArray(events)) {
    return false;
  }
  if (events.includes("*") || events.includes(eventType)) {
    return true;
  }
  // Merchants who only opted into legacy COD still receive unified order.created.
  if (eventType === "order.created" && events.includes("cod_order.created")) {
    return true;
  }
  return false;
}

/** Events that should fire at most once per entity key (24h window). */
const DEDUPE_EVENTS = new Set<string>([
  "order.created",
  "order.cancelled",
  "payment.paid",
  "payment.failed",
  "inventory.low",
  "billing.past_due",
  "billing.invoice_ready",
]);

function extractDedupeEntityId(eventType: string, payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  };

  if (eventType === "inventory.low") {
    return pick("variantId", "variant_id", "productId", "product_id", "inventoryItemId");
  }
  if (eventType === "billing.past_due") {
    return pick("subscriptionId", "tenantId") ?? "subscription";
  }
  if (eventType === "billing.invoice_ready") {
    return pick("invoiceId", "invoice_id", "subscriptionId");
  }
  return pick("orderId", "order_id");
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
  const rawEvents = Array.isArray(preference.events)
    ? preference.events.filter((event): event is string => typeof event === "string")
    : [];
  return {
    id: preference.id,
    channel: preference.channel,
    enabled: preference.enabled,
    // Surface canonical ids (legacy cod_order.created → order.created).
    events: normalizeEvents(rawEvents),
    target: preference.target,
    updatedAt: preference.updatedAt.toISOString(),
  };
}

function normalizeChannel(channel: string) {
  return channel.trim().toLowerCase();
}

function normalizeEvents(events: string[]) {
  return [
    ...new Set(
      events
        .map((event) => event.trim())
        .filter(Boolean)
        .map((event) => canonicalizeNotificationEventType(event)),
    ),
  ];
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
  const inbox = createInAppNotificationService(db);

  return {
    inbox,
    listNotificationPreferences: async (input: {
      tenantId: string;
    }): Promise<NotificationPreferenceListResult> => {
      const preferences = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.tenantId, input.tenantId));

      // Email is single-target: if legacy duplicates exist, surface the newest only.
      const newestEmailByUpdatedAt = preferences
        .filter((preference) => preference.channel === "email")
        .sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        )[0];
      const deduped = preferences.filter((preference) => {
        if (preference.channel !== "email") return true;
        return newestEmailByUpdatedAt ? preference.id === newestEmailByUpdatedAt.id : true;
      });

      return {
        ok: true,
        preferences: deduped.map(serializeNotificationPreference),
      };
    },
    recordNotificationEvent: async (input: {
      eventType: NotificationEventType;
      payload?: unknown;
      tenantId: string;
    }): Promise<NotificationEventRecordResult> => {
      const eventType = canonicalizeNotificationEventType(input.eventType) as NotificationEventType;
      const payload =
        input.payload !== undefined && input.payload !== null && typeof input.payload === "object"
          ? input.payload
          : {};

      // In-app inbox is independent of email/Telegram configuration.
      // Failures here must not block external delivery (and vice versa).
      try {
        await inbox.tryCreateFromEvent({
          eventType,
          payload,
          tenantId: input.tenantId,
          userId: null,
        });
      } catch {
        // Swallow — tryCreateFromEvent already isolates errors; belt-and-suspenders.
      }

      // Platform + Medusa (or lifecycle retries) can emit the same logical event twice.
      // Skip additional external delivery logs within a 24h window for the same entity.
      const entityId = extractDedupeEntityId(eventType, payload);
      if (entityId && DEDUPE_EVENTS.has(eventType)) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [existing] = await db
          .select({ id: notificationLogs.id })
          .from(notificationLogs)
          .where(
            and(
              eq(notificationLogs.tenantId, input.tenantId),
              eq(notificationLogs.eventType, eventType),
              gte(notificationLogs.createdAt, cutoff),
              or(
                sql`${notificationLogs.payload}->>'orderId' = ${entityId}`,
                sql`${notificationLogs.payload}->>'order_id' = ${entityId}`,
                sql`${notificationLogs.payload}->>'variantId' = ${entityId}`,
                sql`${notificationLogs.payload}->>'productId' = ${entityId}`,
                sql`${notificationLogs.payload}->>'invoiceId' = ${entityId}`,
                sql`${notificationLogs.payload}->>'subscriptionId' = ${entityId}`,
              ),
            ),
          )
          .limit(1);

        if (existing) {
          return {
            ok: true,
            logCount: 0,
            logIds: [],
          };
        }
      }

      // Email (and legacy preference rows) still use notification_preferences.
      // Telegram multi-connect uses notification_destinations.
      const preferences = await db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.tenantId, input.tenantId),
            eq(notificationPreferences.enabled, true),
          ),
        );

      const matchingPreferences = getMatchingPreferences(preferences, eventType).filter(
        (preference) => preference.channel !== "telegram",
      );

      const destinations = await db
        .select()
        .from(notificationDestinations)
        .where(
          and(
            eq(notificationDestinations.tenantId, input.tenantId),
            eq(notificationDestinations.enabled, true),
          ),
        );

      const matchingDestinations = destinations.filter((destination) =>
        eventMatchesPreference(destination.events, eventType),
      );

      type DeliveryTarget = { channel: string; recipient: string };
      const targets: DeliveryTarget[] = [
        ...matchingPreferences.map((preference) => ({
          channel: preference.channel,
          recipient: preference.target,
        })),
        ...matchingDestinations.map((destination) => ({
          channel: destination.channel,
          recipient: destination.target,
        })),
      ];

      if (targets.length === 0) {
        return {
          ok: true,
          logCount: 0,
          logIds: [],
        };
      }

      const inserted = await db
        .insert(notificationLogs)
        .values(
          targets.map((target) => ({
            tenantId: input.tenantId,
            eventType,
            channel: target.channel,
            recipient: target.recipient,
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
     * Send a test notification for one channel/destination.
     * Telegram: uses notification_destinations (optional destinationId).
     * Email: uses notification_preferences.
     */
    sendTestNotification: async (input: {
      channel: string;
      tenantId: string;
      destinationId?: string;
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

      let recipient: string | null = null;

      if (channel === "telegram") {
        if (input.destinationId?.trim()) {
          const [destination] = await db
            .select()
            .from(notificationDestinations)
            .where(
              and(
                eq(notificationDestinations.id, input.destinationId.trim()),
                eq(notificationDestinations.tenantId, input.tenantId),
                eq(notificationDestinations.channel, "telegram"),
                eq(notificationDestinations.enabled, true),
              ),
            )
            .limit(1);
          recipient = destination?.target ?? null;
        } else {
          const [destination] = await db
            .select()
            .from(notificationDestinations)
            .where(
              and(
                eq(notificationDestinations.tenantId, input.tenantId),
                eq(notificationDestinations.channel, "telegram"),
                eq(notificationDestinations.enabled, true),
              ),
            )
            .limit(1);
          recipient = destination?.target ?? null;
        }
      } else {
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
        recipient = preference?.target ?? null;
      }

      if (!recipient) {
        return { ok: false, error: "notification_preference_missing", status: 404 };
      }

      const [tenant] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      let destinationLabel: string | undefined;
      if (channel === "telegram" && input.destinationId?.trim()) {
        const [destination] = await db
          .select({ label: notificationDestinations.label })
          .from(notificationDestinations)
          .where(
            and(
              eq(notificationDestinations.id, input.destinationId.trim()),
              eq(notificationDestinations.tenantId, input.tenantId),
            ),
          )
          .limit(1);
        if (destination?.label?.trim()) {
          destinationLabel = destination.label.trim();
        }
      } else if (channel === "email") {
        destinationLabel = recipient;
      }

      const testPayload: Record<string, unknown> = {
        source: "dashboard_test",
        channel,
        sentAt: new Date().toISOString(),
        testId: crypto.randomUUID(),
      };
      if (tenant?.name?.trim()) {
        testPayload.shopName = tenant.name.trim();
      }
      if (destinationLabel) {
        testPayload.destinationLabel = destinationLabel;
      }

      // Channel tests only go to that channel (Telegram/email). Never write to the
      // in-app inbox — merchants are verifying external delivery, not the bell feed.

      const [log] = await db
        .insert(notificationLogs)
        .values({
          tenantId: input.tenantId,
          eventType: "notification.test",
          channel,
          recipient,
          status: "pending",
          payload: testPayload,
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
        // Email is single-target per tenant: match on channel so address changes
        // update the same row instead of inserting a second preference.
        // Other channels keep target in the uniqueness key.
        const [existing] = await transaction
          .select({ id: notificationPreferences.id })
          .from(notificationPreferences)
          .where(
            channel === "email"
              ? and(
                  eq(notificationPreferences.tenantId, input.tenantId),
                  eq(notificationPreferences.channel, channel),
                )
              : and(
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
                target,
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

        // Drop legacy duplicate email rows left by target-keyed upserts.
        if (channel === "email") {
          await transaction
            .delete(notificationPreferences)
            .where(
              and(
                eq(notificationPreferences.tenantId, input.tenantId),
                eq(notificationPreferences.channel, "email"),
                ne(notificationPreferences.id, writtenPreference.id),
              ),
            );
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
