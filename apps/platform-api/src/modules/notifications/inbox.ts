import type { createPlatformDb } from "@ecs/db";
import {
  inAppNotificationEvents,
  inAppNotificationReceipts,
  inAppNotifications,
  organizationMembers,
  tenants,
  users,
} from "@ecs/db";
import { and, count, desc, eq, gt, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { createMerchantPermissionLookup } from "../../auth/merchant-authorization.js";
import type { MerchantPermissionRequest } from "../../auth/merchant-permissions.js";
import type { NotificationEventType } from "../../types/index.js";
import { createCodeNotificationRenderer } from "./renderer.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type InboxCategory = "billing" | "inquiries" | "inventory" | "orders" | "system";
type InboxPriority = "high" | "normal";

export type InAppAudience =
  | { type: "all_members" }
  | { type: "permission"; permission: MerchantPermissionRequest }
  | { type: "roles"; roles: string[] }
  | { type: "users"; userIds: string[] };

export const IN_APP_EVENT_SET = new Set<string>([
  "order.created",
  "order.cancelled",
  "payment.paid",
  "payment.failed",
  "inventory.low",
  "billing.past_due",
  "billing.invoice_ready",
  "storefront.inquiry_created",
]);

export type InAppNotificationView = {
  id: string;
  eventType: string;
  category: InboxCategory;
  priority: InboxPriority;
  title: string;
  body: string;
  href: string | null;
  groupKey: string | null;
  occurrenceCount: number;
  readAt: string | null;
  seenAt: string | null;
  createdAt: string;
};

const renderer = createCodeNotificationRenderer();

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function pickString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

const RECURRING_EVENT_SET = new Set(["billing.past_due", "inventory.low", "payment.failed"]);

export function buildInAppDedupeKey(eventType: string, payload: unknown, now = new Date()): string {
  const data = asRecord(payload);
  const eventId = pickString(data, "eventId", "event_id");
  if (eventId) return `${eventType}:${eventId}`;
  const entity =
    pickString(
      data,
      "orderId",
      "order_id",
      "orderDisplayId",
      "displayId",
      "txRef",
      "variantId",
      "productId",
      "invoiceId",
      "subscriptionId",
      "inquiryId",
    ) ?? null;
  if (eventType === "notification.test") {
    return `notification.test:${pickString(data, "testId", "id") ?? crypto.randomUUID()}`;
  }
  if (entity) {
    const bucket = RECURRING_EVENT_SET.has(eventType) ? `:${now.toISOString().slice(0, 10)}` : "";
    return `${eventType}:${entity}${bucket}`;
  }
  try {
    return `${eventType}:${JSON.stringify(data, Object.keys(data).sort()).slice(0, 120)}`;
  } catch {
    return `${eventType}:${crypto.randomUUID()}`;
  }
}

export function buildInAppHref(eventType: string, payload: unknown): string | null {
  const data = asRecord(payload);
  const orderId = pickString(data, "orderId", "order_id");
  const productId = pickString(data, "productId", "product_id");
  if (
    orderId &&
    (eventType.startsWith("order.") ||
      eventType.startsWith("payment.") ||
      eventType === "cod_order.created")
  ) {
    return `/admin/orders/${encodeURIComponent(orderId)}`;
  }
  if (
    eventType.startsWith("order.") ||
    eventType.startsWith("payment.") ||
    eventType === "cod_order.created"
  ) {
    return "/admin/orders";
  }
  if (eventType === "inventory.low" && productId) {
    return `/admin/products/${encodeURIComponent(productId)}`;
  }
  if (eventType === "inventory.low") return "/admin/products";
  if (eventType.startsWith("billing.")) return "/admin/billing";
  if (eventType === "storefront.inquiry_created") return "/admin/inquiries";
  return null;
}

function eventPolicy(eventType: string, payload: unknown) {
  const data = asRecord(payload);
  if (eventType.startsWith("order.") || eventType.startsWith("payment.")) {
    return {
      audience: { type: "permission", permission: { orders: ["read"] } } as InAppAudience,
      category: "orders" as const,
      groupKey: pickString(data, "orderId", "order_id")
        ? `${eventType}:${pickString(data, "orderId", "order_id")}`
        : null,
      priority: eventType === "payment.failed" ? ("high" as const) : ("normal" as const),
      retentionDays: eventType === "payment.failed" ? 180 : 90,
    };
  }
  if (eventType === "inventory.low") {
    return {
      audience: { type: "permission", permission: { products: ["read"] } } as InAppAudience,
      category: "inventory" as const,
      groupKey: `${eventType}:${pickString(data, "productId", "variantId") ?? "all"}`,
      priority: "normal" as const,
      retentionDays: 30,
    };
  }
  if (eventType.startsWith("billing.")) {
    return {
      audience: { type: "permission", permission: { billing: ["read"] } } as InAppAudience,
      category: "billing" as const,
      groupKey: pickString(data, "invoiceId", "subscriptionId")
        ? `${eventType}:${pickString(data, "invoiceId", "subscriptionId")}`
        : null,
      priority: eventType === "billing.past_due" ? ("high" as const) : ("normal" as const),
      retentionDays: eventType === "billing.past_due" ? 180 : 90,
    };
  }
  if (eventType === "storefront.inquiry_created") {
    return {
      audience: { type: "permission", permission: { inquiries: ["read"] } } as InAppAudience,
      category: "inquiries" as const,
      groupKey: pickString(data, "inquiryId")
        ? `${eventType}:${pickString(data, "inquiryId")}`
        : null,
      priority: "normal" as const,
      retentionDays: 90,
    };
  }
  return {
    audience: { type: "all_members" } as InAppAudience,
    category: "system" as const,
    groupKey: null,
    priority: "normal" as const,
    retentionDays: 30,
  };
}

function titleFromRender(eventType: string, subject: string | undefined, body: string): string {
  return (
    subject?.trim() ||
    body
      .split("\n")
      .find((line) => line.trim())
      ?.trim() ||
    eventType
  ).slice(0, 200);
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify([createdAt.toISOString(), id]), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const date = new Date(String(parsed[0]));
    const id = String(parsed[1]);
    return Number.isNaN(date.getTime()) || !id ? null : { createdAt: date, id };
  } catch {
    return null;
  }
}

export function createInAppNotificationService(db: PlatformDb) {
  const hasPermission = createMerchantPermissionLookup(db);

  async function resolveRecipients(tenantId: string, audience: InAppAudience) {
    const members = await db
      .select({
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
        userId: organizationMembers.userId,
      })
      .from(organizationMembers)
      .innerJoin(tenants, eq(tenants.organizationId, organizationMembers.organizationId))
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(
        and(
          eq(tenants.id, tenantId),
          eq(organizationMembers.status, "active"),
          eq(users.status, "active"),
        ),
      );
    if (audience.type === "all_members") return members.map((member) => member.userId);
    if (audience.type === "users") {
      const selected = new Set(audience.userIds);
      return members.filter((member) => selected.has(member.userId)).map((member) => member.userId);
    }
    if (audience.type === "roles") {
      const selected = new Set(audience.roles);
      return members
        .filter((member) => member.role.split(",").some((role) => selected.has(role.trim())))
        .map((member) => member.userId);
    }
    const allowed = await Promise.all(
      members.map(async (member) => ({
        allowed: await hasPermission({
          organizationId: member.organizationId,
          permission: audience.permission,
          role: member.role,
        }),
        userId: member.userId,
      })),
    );
    return allowed.filter((member) => member.allowed).map((member) => member.userId);
  }

  const core = {
    createFromEvent: async (input: {
      eventType: string;
      payload?: unknown;
      tenantId: string;
      audience?: InAppAudience;
      sourceEventId?: string;
    }): Promise<{ created: boolean; id?: string; recipients: number }> => {
      if (!IN_APP_EVENT_SET.has(input.eventType)) return { created: false, recipients: 0 };
      const payload = asRecord(input.payload);
      const policy = eventPolicy(input.eventType, payload);
      const audience = input.audience ?? policy.audience;
      const userIds = await resolveRecipients(input.tenantId, audience);
      if (!userIds.length) return { created: false, recipients: 0 };
      const rendered = await Promise.resolve(
        renderer.render({
          channel: "in_app",
          eventType: input.eventType,
          payload,
          recipient: "in_app",
          tenantId: input.tenantId,
        }),
      );
      const expiresAt = new Date(Date.now() + policy.retentionDays * 86_400_000);
      return db.transaction(async (transaction) => {
        const insert = transaction.insert(inAppNotifications).values({
          audience,
          audienceType: audience.type,
          body: rendered.body.slice(0, 2000),
          category: policy.category,
          dedupeKey: policy.groupKey ?? buildInAppDedupeKey(input.eventType, payload),
          eventType: input.eventType,
          expiresAt,
          groupKey: policy.groupKey,
          href: buildInAppHref(input.eventType, payload),
          lastEventId: input.sourceEventId,
          payload,
          priority: policy.priority,
          tenantId: input.tenantId,
          title: titleFromRender(input.eventType, rendered.subject, rendered.body),
        });
        const [notification] = input.sourceEventId
          ? await insert
              .onConflictDoUpdate({
                set: {
                  audience,
                  audienceType: audience.type,
                  body: rendered.body.slice(0, 2000),
                  category: policy.category,
                  expiresAt,
                  href: buildInAppHref(input.eventType, payload),
                  lastEventId: input.sourceEventId,
                  lastOccurredAt: new Date(),
                  occurrenceCount: sql`${inAppNotifications.occurrenceCount} + 1`,
                  payload,
                  priority: policy.priority,
                  title: titleFromRender(input.eventType, rendered.subject, rendered.body),
                },
                setWhere: sql`${inAppNotifications.lastEventId} IS DISTINCT FROM ${input.sourceEventId}`,
                target: [inAppNotifications.tenantId, inAppNotifications.dedupeKey],
              })
              .returning({ id: inAppNotifications.id })
          : await insert
              .onConflictDoNothing({
                target: [inAppNotifications.tenantId, inAppNotifications.dedupeKey],
              })
              .returning({ id: inAppNotifications.id });
        if (!notification) return { created: false, recipients: 0 };
        const occurredAt = new Date();
        await transaction
          .insert(inAppNotificationReceipts)
          .values(
            userIds.map((userId) => ({
              notificationId: notification.id,
              tenantId: input.tenantId,
              userId,
            })),
          )
          .onConflictDoUpdate({
            set: { archivedAt: null, readAt: null, seenAt: null, createdAt: occurredAt },
            target: [inAppNotificationReceipts.notificationId, inAppNotificationReceipts.userId],
          });
        return { created: true, id: notification.id, recipients: userIds.length };
      });
    },

    list: async (input: {
      tenantId: string;
      actorUserId: string;
      category?: InboxCategory;
      cursor?: string;
      limit?: number;
      offset?: number;
      q?: string;
      unreadOnly?: boolean;
    }): Promise<{ count: number; items: InAppNotificationView[]; nextCursor: string | null }> => {
      const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
      const offset = Math.min(Math.max(input.offset ?? 0, 0), 10_000);
      const q = input.q?.trim().slice(0, 120);
      const cursor = decodeCursor(input.cursor);
      const baseWhere = and(
        eq(inAppNotificationReceipts.tenantId, input.tenantId),
        eq(inAppNotificationReceipts.userId, input.actorUserId),
        isNull(inAppNotificationReceipts.archivedAt),
        input.unreadOnly ? isNull(inAppNotificationReceipts.readAt) : undefined,
        input.category ? eq(inAppNotifications.category, input.category) : undefined,
        q
          ? or(ilike(inAppNotifications.title, `%${q}%`), ilike(inAppNotifications.body, `%${q}%`))
          : undefined,
        or(isNull(inAppNotifications.expiresAt), gt(inAppNotifications.expiresAt, new Date())),
      );
      const cursorWhere = cursor
        ? or(
            lt(inAppNotifications.lastOccurredAt, cursor.createdAt),
            and(
              eq(inAppNotifications.lastOccurredAt, cursor.createdAt),
              lt(inAppNotifications.id, cursor.id),
            ),
          )
        : undefined;
      const [rows, total] = await Promise.all([
        db
          .select({ notification: inAppNotifications, receipt: inAppNotificationReceipts })
          .from(inAppNotificationReceipts)
          .innerJoin(
            inAppNotifications,
            eq(inAppNotifications.id, inAppNotificationReceipts.notificationId),
          )
          .where(and(baseWhere, cursorWhere))
          .orderBy(desc(inAppNotifications.lastOccurredAt), desc(inAppNotifications.id))
          .limit(limit + 1)
          .offset(cursor ? 0 : offset),
        db
          .select({ value: count() })
          .from(inAppNotificationReceipts)
          .innerJoin(
            inAppNotifications,
            eq(inAppNotifications.id, inAppNotificationReceipts.notificationId),
          )
          .where(baseWhere),
      ]);
      const page = rows.slice(0, limit);
      const items = page.map(({ notification, receipt }) => ({
        id: notification.id,
        body: notification.body,
        category: notification.category as InboxCategory,
        createdAt: notification.lastOccurredAt.toISOString(),
        eventType: notification.eventType,
        groupKey: notification.groupKey,
        href: notification.href,
        occurrenceCount: notification.occurrenceCount,
        priority: notification.priority as InboxPriority,
        readAt: receipt.readAt?.toISOString() ?? null,
        seenAt: receipt.seenAt?.toISOString() ?? null,
        title: notification.title,
      }));
      const last = page.at(-1)?.notification;
      return {
        count: Number(total[0]?.value ?? 0),
        items,
        nextCursor: rows.length > limit && last ? encodeCursor(last.lastOccurredAt, last.id) : null,
      };
    },

    unreadCount: async (input: { tenantId: string; actorUserId: string }) => {
      const [row] = await db
        .select({ value: count() })
        .from(inAppNotificationReceipts)
        .innerJoin(
          inAppNotifications,
          eq(inAppNotifications.id, inAppNotificationReceipts.notificationId),
        )
        .where(
          and(
            eq(inAppNotificationReceipts.tenantId, input.tenantId),
            eq(inAppNotificationReceipts.userId, input.actorUserId),
            isNull(inAppNotificationReceipts.readAt),
            isNull(inAppNotificationReceipts.archivedAt),
            or(isNull(inAppNotifications.expiresAt), gt(inAppNotifications.expiresAt, new Date())),
          ),
        );
      return { count: Number(row?.value ?? 0) };
    },

    setRead: async (input: {
      tenantId: string;
      id: string;
      actorUserId: string;
      read: boolean;
    }) => {
      const [updated] = await db
        .update(inAppNotificationReceipts)
        .set({ readAt: input.read ? new Date() : null })
        .where(
          and(
            eq(inAppNotificationReceipts.notificationId, input.id),
            eq(inAppNotificationReceipts.tenantId, input.tenantId),
            eq(inAppNotificationReceipts.userId, input.actorUserId),
            isNull(inAppNotificationReceipts.archivedAt),
          ),
        )
        .returning({ id: inAppNotificationReceipts.id });
      return updated
        ? ({ ok: true } as const)
        : ({ error: "not_found", ok: false, status: 404 } as const);
    },

    markAllRead: async (input: { tenantId: string; actorUserId: string }) => {
      const updated = await db
        .update(inAppNotificationReceipts)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(inAppNotificationReceipts.tenantId, input.tenantId),
            eq(inAppNotificationReceipts.userId, input.actorUserId),
            isNull(inAppNotificationReceipts.readAt),
            isNull(inAppNotificationReceipts.archivedAt),
          ),
        )
        .returning({ id: inAppNotificationReceipts.id });
      return { ok: true as const, updated: updated.length };
    },

    markSeen: async (input: { tenantId: string; actorUserId: string; ids: string[] }) => {
      const ids = [...new Set(input.ids.filter(Boolean))].slice(0, 50);
      if (!ids.length) return { ok: true as const, updated: 0 };
      const updated = await db
        .update(inAppNotificationReceipts)
        .set({ seenAt: new Date() })
        .where(
          and(
            eq(inAppNotificationReceipts.tenantId, input.tenantId),
            eq(inAppNotificationReceipts.userId, input.actorUserId),
            inArray(inAppNotificationReceipts.notificationId, ids),
            isNull(inAppNotificationReceipts.seenAt),
            isNull(inAppNotificationReceipts.archivedAt),
          ),
        )
        .returning({ id: inAppNotificationReceipts.id });
      return { ok: true as const, updated: updated.length };
    },

    deleteExpired: async (now = new Date()) => {
      const deleted = await db
        .delete(inAppNotifications)
        .where(lt(inAppNotifications.expiresAt, now))
        .returning({ id: inAppNotifications.id });
      return { deleted: deleted.length };
    },

    archive: async (input: { tenantId: string; id: string; actorUserId: string }) => {
      const [updated] = await db
        .update(inAppNotificationReceipts)
        .set({ archivedAt: new Date(), readAt: new Date() })
        .where(
          and(
            eq(inAppNotificationReceipts.notificationId, input.id),
            eq(inAppNotificationReceipts.tenantId, input.tenantId),
            eq(inAppNotificationReceipts.userId, input.actorUserId),
          ),
        )
        .returning({ id: inAppNotificationReceipts.id });
      return updated
        ? ({ ok: true } as const)
        : ({ error: "not_found", ok: false, status: 404 } as const);
    },
  };

  return {
    ...core,
    recordEvent: async (input: { eventType: string; payload?: unknown; tenantId: string }) => {
      if (!IN_APP_EVENT_SET.has(input.eventType)) return null;
      const [event] = await db
        .insert(inAppNotificationEvents)
        .values({
          dedupeKey: buildInAppDedupeKey(input.eventType, input.payload),
          eventType: input.eventType,
          payload: asRecord(input.payload),
          tenantId: input.tenantId,
        })
        .onConflictDoUpdate({
          target: [inAppNotificationEvents.tenantId, inAppNotificationEvents.dedupeKey],
          set: { updatedAt: new Date() },
        })
        .returning({ id: inAppNotificationEvents.id, status: inAppNotificationEvents.status });
      return event ?? null;
    },
    materializeEvent: async (eventId: string) => {
      const staleBefore = new Date(Date.now() - 5 * 60_000);
      const [claimed] = await db
        .update(inAppNotificationEvents)
        .set({
          attempts: sql`${inAppNotificationEvents.attempts} + 1`,
          lastError: null,
          status: "processing",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inAppNotificationEvents.id, eventId),
            or(
              inArray(inAppNotificationEvents.status, ["pending", "failed"]),
              and(
                eq(inAppNotificationEvents.status, "processing"),
                lt(inAppNotificationEvents.updatedAt, staleBefore),
              ),
            ),
          ),
        )
        .returning();
      if (!claimed) {
        const [existing] = await db
          .select({ status: inAppNotificationEvents.status })
          .from(inAppNotificationEvents)
          .where(eq(inAppNotificationEvents.id, eventId))
          .limit(1);
        if (!existing) throw new Error("in_app_event_not_found");
        return { alreadyProcessed: true };
      }
      try {
        const result = await core.createFromEvent({
          eventType: claimed.eventType,
          payload: claimed.payload,
          sourceEventId: claimed.id,
          tenantId: claimed.tenantId,
        });
        await db
          .update(inAppNotificationEvents)
          .set({ processedAt: new Date(), status: "processed", updatedAt: new Date() })
          .where(eq(inAppNotificationEvents.id, claimed.id));
        return { alreadyProcessed: false, ...result };
      } catch (error) {
        await db
          .update(inAppNotificationEvents)
          .set({
            lastError: error instanceof Error ? error.message.slice(0, 500) : "unknown_error",
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(inAppNotificationEvents.id, claimed.id));
        throw error;
      }
    },
    listRecoverableEvents: async (limit = 100) => {
      const staleBefore = new Date(Date.now() - 5 * 60_000);
      return db
        .select({
          attempts: inAppNotificationEvents.attempts,
          id: inAppNotificationEvents.id,
          tenantId: inAppNotificationEvents.tenantId,
        })
        .from(inAppNotificationEvents)
        .where(
          and(
            lt(inAppNotificationEvents.attempts, 10),
            or(
              inArray(inAppNotificationEvents.status, ["pending", "failed"]),
              and(
                eq(inAppNotificationEvents.status, "processing"),
                lt(inAppNotificationEvents.updatedAt, staleBefore),
              ),
            ),
          ),
        )
        .orderBy(inAppNotificationEvents.createdAt)
        .limit(Math.min(Math.max(limit, 1), 500));
    },
  };
}

export type InAppNotificationService = ReturnType<typeof createInAppNotificationService>;

export function isInAppEventType(eventType: string): eventType is NotificationEventType {
  return IN_APP_EVENT_SET.has(eventType);
}
