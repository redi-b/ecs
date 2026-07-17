import { randomBytes } from "node:crypto";
import type { createPlatformDb } from "@ecs/db";
import {
  notificationDestinations,
  telegramConnectSessions,
  tenants,
} from "@ecs/db";
import { and, count, desc, eq, gt } from "drizzle-orm";

import { sendTelegramBotMessage } from "./providers/telegram-provider.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export const DEFAULT_TELEGRAM_EVENTS = [
  "order.created",
  "order.cancelled",
  "payment.paid",
  "payment.failed",
  "notification.test",
] as const;

export const MAX_TELEGRAM_DESTINATIONS = 10;
const SESSION_TTL_MS = 15 * 60 * 1000;

export type TelegramConnectConfig = {
  botToken: string;
  botUsername: string;
};

export type TelegramDestinationView = {
  id: string;
  label: string;
  username: string | null;
  enabled: boolean;
  events: string[];
  connectedAt: string;
};

function createConnectToken() {
  return randomBytes(16).toString("base64url");
}

function buildDeepLink(botUsername: string, token: string) {
  const user = botUsername.replace(/^@/, "").trim();
  return `https://t.me/${user}?start=${encodeURIComponent(token)}`;
}

function displayLabel(input: {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  chatId: string;
}) {
  if (input.username?.trim()) {
    return `@${input.username.replace(/^@/, "").trim()}`;
  }
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  if (name) {
    return name;
  }
  return `Telegram ${input.chatId.slice(-4)}`;
}

function serializeDestination(
  row: typeof notificationDestinations.$inferSelect,
): TelegramDestinationView {
  const metadata =
    typeof row.metadata === "object" && row.metadata !== null
      ? (row.metadata as Record<string, unknown>)
      : {};
  const username =
    typeof metadata.username === "string" && metadata.username.trim()
      ? metadata.username.replace(/^@/, "")
      : null;

  return {
    id: row.id,
    label: row.label || displayLabel({ chatId: row.target, username }),
    username,
    enabled: row.enabled,
    events: Array.isArray(row.events)
      ? row.events.filter((event): event is string => typeof event === "string")
      : [],
    connectedAt: row.connectedAt.toISOString(),
  };
}

export function createTelegramConnectService(
  db: PlatformDb,
  config: TelegramConnectConfig | null,
) {
  return {
    isConfigured: () => Boolean(config?.botToken && config?.botUsername),

    listDestinations: async (input: { tenantId: string }) => {
      const rows = await db
        .select()
        .from(notificationDestinations)
        .where(
          and(
            eq(notificationDestinations.tenantId, input.tenantId),
            eq(notificationDestinations.channel, "telegram"),
          ),
        )
        .orderBy(desc(notificationDestinations.connectedAt));

      return { destinations: rows.map(serializeDestination) };
    },

    createConnectSession: async (input: {
      tenantId: string;
      userId: string;
    }) => {
      if (!config?.botToken || !config.botUsername) {
        return {
          ok: false as const,
          error: "telegram_not_configured" as const,
          status: 503 as const,
        };
      }

      const [countRow] = await db
        .select({ value: count() })
        .from(notificationDestinations)
        .where(
          and(
            eq(notificationDestinations.tenantId, input.tenantId),
            eq(notificationDestinations.channel, "telegram"),
          ),
        );

      if (Number(countRow?.value ?? 0) >= MAX_TELEGRAM_DESTINATIONS) {
        return {
          ok: false as const,
          error: "telegram_destination_limit" as const,
          status: 409 as const,
        };
      }

      // Cancel prior pending sessions for this tenant (single active flow).
      await db
        .update(telegramConnectSessions)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(telegramConnectSessions.tenantId, input.tenantId),
            eq(telegramConnectSessions.status, "pending"),
          ),
        );

      const token = createConnectToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      const [session] = await db
        .insert(telegramConnectSessions)
        .values({
          token,
          tenantId: input.tenantId,
          createdByUserId: input.userId,
          status: "pending",
          expiresAt,
        })
        .returning();

      if (!session) {
        throw new Error("Failed to create telegram connect session");
      }

      return {
        ok: true as const,
        session: {
          id: session.id,
          status: session.status,
          expiresAt: session.expiresAt.toISOString(),
          deepLink: buildDeepLink(config.botUsername, token),
        },
      };
    },

    getConnectSession: async (input: { tenantId: string; sessionId: string }) => {
      const [session] = await db
        .select()
        .from(telegramConnectSessions)
        .where(
          and(
            eq(telegramConnectSessions.id, input.sessionId),
            eq(telegramConnectSessions.tenantId, input.tenantId),
          ),
        )
        .limit(1);

      if (!session) {
        return { ok: false as const, error: "session_not_found" as const, status: 404 as const };
      }

      let status = session.status;
      if (status === "pending" && session.expiresAt.getTime() <= Date.now()) {
        await db
          .update(telegramConnectSessions)
          .set({ status: "expired" })
          .where(eq(telegramConnectSessions.id, session.id));
        status = "expired";
      }

      return {
        ok: true as const,
        session: {
          id: session.id,
          status,
          expiresAt: session.expiresAt.toISOString(),
          deepLink:
            status === "pending" && config?.botUsername
              ? buildDeepLink(config.botUsername, session.token)
              : null,
        },
      };
    },

    cancelConnectSession: async (input: { tenantId: string; sessionId: string }) => {
      const [session] = await db
        .select()
        .from(telegramConnectSessions)
        .where(
          and(
            eq(telegramConnectSessions.id, input.sessionId),
            eq(telegramConnectSessions.tenantId, input.tenantId),
          ),
        )
        .limit(1);

      if (!session) {
        return { ok: false as const, error: "session_not_found" as const, status: 404 as const };
      }

      if (session.status === "pending") {
        await db
          .update(telegramConnectSessions)
          .set({ status: "cancelled" })
          .where(eq(telegramConnectSessions.id, session.id));
      }

      return { ok: true as const };
    },

    removeDestination: async (input: { tenantId: string; destinationId: string }) => {
      const deleted = await db
        .delete(notificationDestinations)
        .where(
          and(
            eq(notificationDestinations.id, input.destinationId),
            eq(notificationDestinations.tenantId, input.tenantId),
            eq(notificationDestinations.channel, "telegram"),
          ),
        )
        .returning({ id: notificationDestinations.id });

      if (deleted.length === 0) {
        return { ok: false as const, error: "destination_not_found" as const, status: 404 as const };
      }
      return { ok: true as const };
    },

    setDestinationEnabled: async (input: {
      tenantId: string;
      destinationId: string;
      enabled: boolean;
    }) => {
      const [row] = await db
        .update(notificationDestinations)
        .set({ enabled: input.enabled, updatedAt: new Date() })
        .where(
          and(
            eq(notificationDestinations.id, input.destinationId),
            eq(notificationDestinations.tenantId, input.tenantId),
            eq(notificationDestinations.channel, "telegram"),
          ),
        )
        .returning();

      if (!row) {
        return { ok: false as const, error: "destination_not_found" as const, status: 404 as const };
      }
      return { ok: true as const, destination: serializeDestination(row) };
    },

    /**
     * Apply shared event list to all Telegram destinations for a tenant.
     */
    setSharedEvents: async (input: { tenantId: string; events: string[] }) => {
      const events = [...new Set(input.events.map((e) => e.trim()).filter(Boolean))];
      if (events.length === 0) {
        return { ok: false as const, error: "notification_events_invalid" as const, status: 400 as const };
      }

      await db
        .update(notificationDestinations)
        .set({ events, updatedAt: new Date() })
        .where(
          and(
            eq(notificationDestinations.tenantId, input.tenantId),
            eq(notificationDestinations.channel, "telegram"),
          ),
        );

      return { ok: true as const, events };
    },

    /**
     * Handle Telegram update (webhook). Returns ok for Telegram even on no-op.
     */
    handleWebhookUpdate: async (update: unknown) => {
      if (!config?.botToken) {
        return { handled: false as const, reason: "not_configured" as const };
      }

      if (typeof update !== "object" || update === null) {
        return { handled: false as const, reason: "invalid_update" as const };
      }

      const message = (update as { message?: unknown }).message;
      if (typeof message !== "object" || message === null) {
        return { handled: false as const, reason: "no_message" as const };
      }

      const chat = (message as { chat?: unknown }).chat;
      const text = (message as { text?: unknown }).text;
      const from = (message as { from?: unknown }).from;

      if (typeof chat !== "object" || chat === null) {
        return { handled: false as const, reason: "no_chat" as const };
      }

      const chatType = (chat as { type?: unknown }).type;
      const chatIdRaw = (chat as { id?: unknown }).id;
      const chatId = chatIdRaw != null ? String(chatIdRaw) : "";

      if (!chatId) {
        return { handled: false as const, reason: "no_chat_id" as const };
      }

      if (chatType !== "private") {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId,
          text: "Please connect from a private chat with this bot (not a group).",
        }).catch(() => undefined);
        return { handled: true as const, reason: "group_rejected" as const };
      }

      if (typeof text !== "string" || !text.startsWith("/start")) {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId,
          text: "Open Notifications in your shop dashboard and tap Connect Telegram to link this chat.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "help" as const };
      }

      const token = text.replace(/^\/start(@\w+)?\s*/i, "").trim();
      if (!token) {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId,
          text: "Open Notifications in your shop dashboard and tap Connect Telegram to link this chat.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "missing_token" as const };
      }

      const [session] = await db
        .select()
        .from(telegramConnectSessions)
        .where(
          and(
            eq(telegramConnectSessions.token, token),
            eq(telegramConnectSessions.status, "pending"),
            gt(telegramConnectSessions.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!session) {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId,
          text: "This connect link is invalid or expired. Go back to your dashboard and try Connect Telegram again.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "invalid_token" as const };
      }

      const [countRow] = await db
        .select({ value: count() })
        .from(notificationDestinations)
        .where(
          and(
            eq(notificationDestinations.tenantId, session.tenantId),
            eq(notificationDestinations.channel, "telegram"),
          ),
        );

      // Allow reconnect of same chat_id without counting as new if already present.
      const [existingSame] = await db
        .select({ id: notificationDestinations.id })
        .from(notificationDestinations)
        .where(
          and(
            eq(notificationDestinations.tenantId, session.tenantId),
            eq(notificationDestinations.channel, "telegram"),
            eq(notificationDestinations.target, chatId),
          ),
        )
        .limit(1);

      if (!existingSame && Number(countRow?.value ?? 0) >= MAX_TELEGRAM_DESTINATIONS) {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId,
          text: "This shop already has the maximum number of Telegram connections.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "limit" as const };
      }

      const username =
        typeof from === "object" && from !== null && typeof (from as { username?: unknown }).username === "string"
          ? String((from as { username: string }).username)
          : null;
      const firstName =
        typeof from === "object" &&
        from !== null &&
        typeof (from as { first_name?: unknown }).first_name === "string"
          ? String((from as { first_name: string }).first_name)
          : null;
      const lastName =
        typeof from === "object" &&
        from !== null &&
        typeof (from as { last_name?: unknown }).last_name === "string"
          ? String((from as { last_name: string }).last_name)
          : null;

      const label = displayLabel({ username, firstName, lastName, chatId });
      const metadata = {
        username,
        firstName,
        lastName,
        chatType: "private",
      };

      // Copy events from an existing destination if any; else defaults.
      const [sample] = await db
        .select({ events: notificationDestinations.events })
        .from(notificationDestinations)
        .where(
          and(
            eq(notificationDestinations.tenantId, session.tenantId),
            eq(notificationDestinations.channel, "telegram"),
          ),
        )
        .limit(1);

      const events =
        sample && Array.isArray(sample.events) && sample.events.length > 0
          ? sample.events
          : [...DEFAULT_TELEGRAM_EVENTS];

      const now = new Date();
      if (existingSame) {
        await db
          .update(notificationDestinations)
          .set({
            label,
            metadata,
            enabled: true,
            updatedAt: now,
            connectedAt: now,
          })
          .where(eq(notificationDestinations.id, existingSame.id));
      } else {
        await db.insert(notificationDestinations).values({
          tenantId: session.tenantId,
          channel: "telegram",
          target: chatId,
          label,
          enabled: true,
          events,
          metadata,
          connectedAt: now,
          updatedAt: now,
        });
      }

      await db
        .update(telegramConnectSessions)
        .set({ status: "consumed", consumedAt: now })
        .where(eq(telegramConnectSessions.id, session.id));

      const [tenant] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, session.tenantId))
        .limit(1);

      const shopName = tenant?.name?.trim() || "your shop";
      await sendTelegramBotMessage({
        botToken: config.botToken,
        chatId,
        text: `Connected to ${shopName}. You will receive merchant alerts here. You can disconnect anytime from the dashboard.`,
      }).catch(() => undefined);

      return { handled: true as const, reason: "connected" as const };
    },
  };
}

export type TelegramConnectService = ReturnType<typeof createTelegramConnectService>;
