import type { createPlatformDb } from "@ecs/db";
import { inAppNotifications } from "@ecs/db";
import { and, count, desc, eq, isNull, or } from "drizzle-orm";

import type { NotificationEventType } from "../../types/index.js";
import { createCodeNotificationRenderer } from "./renderer.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

/**
 * Commerce events that create tenant-wide inbox items in v1.
 * Channel delivery tests (`notification.test`) are intentionally excluded:
 * those only verify Telegram/email pipes, not the in-app bell.
 */
export const IN_APP_EVENT_SET = new Set<string>([
  "order.created",
  "order.cancelled",
  "payment.paid",
  "payment.failed",
]);

export type InAppNotificationView = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const renderer = createCodeNotificationRenderer();

function asRecord(payload: unknown): Record<string, unknown> {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function pickString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Stable dedupe key so re-ingested commerce events do not spam the feed.
 */
export function buildInAppDedupeKey(eventType: string, payload: unknown): string {
  const data = asRecord(payload);
  const entity =
    pickString(data, "orderId", "order_id", "orderDisplayId", "displayId", "txRef", "eventId") ??
    null;

  if (eventType === "notification.test") {
    const testId = pickString(data, "testId", "id") ?? crypto.randomUUID();
    return `notification.test:${testId}`;
  }

  if (entity) {
    return `${eventType}:${entity}`;
  }

  // Last resort: still dedupe identical empty payloads for the same event type
  // by using a short hash of sorted keys (rarely hit).
  try {
    const stable = JSON.stringify(data, Object.keys(data).sort());
    return `${eventType}:${stable.slice(0, 120)}`;
  } catch {
    return `${eventType}:${crypto.randomUUID()}`;
  }
}

/**
 * Dashboard-relative path only. External URLs rejected.
 */
export function buildInAppHref(eventType: string, payload: unknown): string | null {
  const data = asRecord(payload);
  const orderId = pickString(data, "orderId", "order_id");

  if (
    orderId &&
    (eventType.startsWith("order.") ||
      eventType.startsWith("payment.") ||
      eventType === "cod_order.created") // legacy inbox rows
  ) {
    return `/admin/orders/${encodeURIComponent(orderId)}`;
  }

  if (
    eventType.startsWith("order.") ||
    eventType.startsWith("payment.") ||
    eventType === "cod_order.created" // legacy inbox rows
  ) {
    return "/admin/orders";
  }

  return null;
}

function titleFromRender(eventType: string, subject: string | undefined, body: string): string {
  if (subject?.trim()) {
    return subject.trim().slice(0, 200);
  }
  const firstLine = body.split("\n").find((line) => line.trim())?.trim();
  if (firstLine) {
    return firstLine.slice(0, 200);
  }
  return eventType;
}

function serializeRow(
  row: typeof inAppNotifications.$inferSelect,
): InAppNotificationView {
  return {
    id: row.id,
    eventType: row.eventType,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Visibility for actor: tenant-wide (user_id null) + personal rows for this user.
 * v1 always writes user_id null; filter still correct when personal rows appear later.
 */
export function inAppVisibilitySql(tenantId: string, actorUserId?: string | null) {
  if (actorUserId?.trim()) {
    return and(
      eq(inAppNotifications.tenantId, tenantId),
      or(isNull(inAppNotifications.userId), eq(inAppNotifications.userId, actorUserId.trim())),
    );
  }
  return and(eq(inAppNotifications.tenantId, tenantId), isNull(inAppNotifications.userId));
}

export function createInAppNotificationService(db: PlatformDb) {
  return {
    /**
     * Create a tenant-wide inbox item when the event is in the v1 allowlist.
     * Idempotent on (tenantId, dedupeKey). Never throws to callers — returns false on failure.
     */
    tryCreateFromEvent: async (input: {
      eventType: string;
      payload?: unknown;
      tenantId: string;
      /** Reserved; v1 always leaves null (tenant-wide). */
      userId?: string | null;
    }): Promise<{ created: boolean; id?: string }> => {
      if (!IN_APP_EVENT_SET.has(input.eventType)) {
        return { created: false };
      }

      const payload =
        input.payload !== undefined && input.payload !== null && typeof input.payload === "object"
          ? input.payload
          : {};
      const dedupeKey = buildInAppDedupeKey(input.eventType, payload);
      const rendered = await Promise.resolve(
        renderer.render({
          channel: "in_app",
          eventType: input.eventType,
          tenantId: input.tenantId,
          payload,
          recipient: "in_app",
        }),
      );
      const title = titleFromRender(input.eventType, rendered.subject, rendered.body);
      const body = rendered.body.slice(0, 2000);
      const href = buildInAppHref(input.eventType, payload);

      try {
        const [row] = await db
          .insert(inAppNotifications)
          .values({
            tenantId: input.tenantId,
            userId: input.userId?.trim() || null,
            eventType: input.eventType,
            dedupeKey,
            title,
            body,
            href,
            payload,
          })
          .onConflictDoNothing({
            target: [inAppNotifications.tenantId, inAppNotifications.dedupeKey],
          })
          .returning({ id: inAppNotifications.id });

        if (!row) {
          return { created: false };
        }
        return { created: true, id: row.id };
      } catch {
        return { created: false };
      }
    },

    list: async (input: {
      tenantId: string;
      actorUserId?: string | null;
      limit?: number;
      unreadOnly?: boolean;
    }): Promise<{ items: InAppNotificationView[] }> => {
      const limit = Math.min(Math.max(input.limit ?? 50, 1), 50);
      const visibility = inAppVisibilitySql(input.tenantId, input.actorUserId);
      const whereClause = input.unreadOnly
        ? and(visibility, isNull(inAppNotifications.readAt))
        : visibility;

      const rows = await db
        .select()
        .from(inAppNotifications)
        .where(whereClause)
        .orderBy(desc(inAppNotifications.createdAt))
        .limit(limit);

      return { items: rows.map(serializeRow) };
    },

    unreadCount: async (input: {
      tenantId: string;
      actorUserId?: string | null;
    }): Promise<{ count: number }> => {
      const visibility = inAppVisibilitySql(input.tenantId, input.actorUserId);
      const [row] = await db
        .select({ value: count() })
        .from(inAppNotifications)
        .where(and(visibility, isNull(inAppNotifications.readAt)));

      return { count: Number(row?.value ?? 0) };
    },

    markRead: async (input: {
      tenantId: string;
      id: string;
      actorUserId?: string | null;
    }): Promise<{ ok: true } | { ok: false; error: "not_found"; status: 404 }> => {
      const visibility = inAppVisibilitySql(input.tenantId, input.actorUserId);
      const [updated] = await db
        .update(inAppNotifications)
        .set({ readAt: new Date() })
        .where(
          and(visibility, eq(inAppNotifications.id, input.id), isNull(inAppNotifications.readAt)),
        )
        .returning({ id: inAppNotifications.id });

      if (updated) {
        return { ok: true };
      }

      // Already read or missing: treat existing readable row as success.
      const [existing] = await db
        .select({ id: inAppNotifications.id })
        .from(inAppNotifications)
        .where(and(visibility, eq(inAppNotifications.id, input.id)))
        .limit(1);

      if (!existing) {
        return { ok: false, error: "not_found", status: 404 };
      }
      return { ok: true };
    },

    markAllRead: async (input: {
      tenantId: string;
      actorUserId?: string | null;
    }): Promise<{ ok: true; updated: number }> => {
      const visibility = inAppVisibilitySql(input.tenantId, input.actorUserId);
      const updated = await db
        .update(inAppNotifications)
        .set({ readAt: new Date() })
        .where(and(visibility, isNull(inAppNotifications.readAt)))
        .returning({ id: inAppNotifications.id });

      return { ok: true, updated: updated.length };
    },
  };
}

export type InAppNotificationService = ReturnType<typeof createInAppNotificationService>;

export function isInAppEventType(eventType: string): eventType is NotificationEventType {
  return IN_APP_EVENT_SET.has(eventType);
}
