import type { createPlatformDb } from "@ecs/db";
import { billingOutboxEvents } from "@ecs/db";
import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";

import type { NotificationEventType } from "../../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type RecordNotificationEvent = (input: {
  eventType: NotificationEventType;
  payload?: unknown;
  tenantId: string;
}) => Promise<unknown>;

const PROCESSING_LEASE_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

function retryAt(attempts: number, now: Date) {
  return new Date(
    now.getTime() + Math.min(2 ** Math.max(attempts - 1, 0) * 5_000, MAX_RETRY_DELAY_MS),
  );
}

function message(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2_000);
}

/** Drains billing events that were committed atomically with their state changes. */
export function createBillingOutbox(
  db: PlatformDb,
  recordNotificationEvent: RecordNotificationEvent,
) {
  async function processEvent(eventId: string) {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
    const [event] = await db
      .update(billingOutboxEvents)
      .set({
        attempts: sql`${billingOutboxEvents.attempts} + 1`,
        lastError: null,
        processingStartedAt: now,
        status: "processing",
        updatedAt: now,
      })
      .where(
        and(
          eq(billingOutboxEvents.id, eventId),
          or(
            and(
              inArray(billingOutboxEvents.status, ["pending", "failed"]),
              lte(billingOutboxEvents.nextAttemptAt, now),
            ),
            and(
              eq(billingOutboxEvents.status, "processing"),
              lte(billingOutboxEvents.processingStartedAt, staleBefore),
            ),
          ),
        ),
      )
      .returning({
        attempts: billingOutboxEvents.attempts,
        eventType: billingOutboxEvents.eventType,
        payload: billingOutboxEvents.payload,
        tenantId: billingOutboxEvents.tenantId,
      });

    if (!event) return "not_claimed" as const;

    try {
      await recordNotificationEvent({
        eventType: event.eventType as NotificationEventType,
        payload: event.payload,
        tenantId: event.tenantId,
      });
      await db
        .update(billingOutboxEvents)
        .set({
          processedAt: new Date(),
          processingStartedAt: null,
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(billingOutboxEvents.id, eventId));
      return "completed" as const;
    } catch (error) {
      const failedAt = new Date();
      await db
        .update(billingOutboxEvents)
        .set({
          lastError: message(error),
          nextAttemptAt: retryAt(event.attempts, failedAt),
          processingStartedAt: null,
          status: "failed",
          updatedAt: failedAt,
        })
        .where(eq(billingOutboxEvents.id, eventId));
      return "failed" as const;
    }
  }

  return {
    processDue: async (input?: { limit?: number; tenantId?: string }) => {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
      const limit = Math.min(Math.max(input?.limit ?? 100, 1), 500);
      const events = await db
        .select({ id: billingOutboxEvents.id })
        .from(billingOutboxEvents)
        .where(
          and(
            input?.tenantId ? eq(billingOutboxEvents.tenantId, input.tenantId) : undefined,
            or(
              and(
                inArray(billingOutboxEvents.status, ["pending", "failed"]),
                lte(billingOutboxEvents.nextAttemptAt, now),
              ),
              and(
                eq(billingOutboxEvents.status, "processing"),
                lte(billingOutboxEvents.processingStartedAt, staleBefore),
              ),
            ),
          ),
        )
        .orderBy(asc(billingOutboxEvents.nextAttemptAt))
        .limit(limit);

      let completed = 0;
      let failed = 0;
      for (const event of events) {
        const result = await processEvent(event.id);
        if (result === "completed") completed += 1;
        if (result === "failed") failed += 1;
      }
      return { scanned: events.length, completed, failed };
    },
  };
}
