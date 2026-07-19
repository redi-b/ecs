import { randomBytes } from "node:crypto";
import type { createPlatformDb } from "@ecs/db";
import {
  notificationDestinations,
  telegramConnectSessions,
  tenants,
} from "@ecs/db";
import { and, count, desc, eq } from "drizzle-orm";

import { sendTelegramBotMessage } from "./providers/telegram-provider.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export const DEFAULT_TELEGRAM_EVENTS = [
  "order.created",
  "order.cancelled",
  "payment.paid",
  "payment.failed",
  "inventory.low",
  "billing.past_due",
  "billing.invoice_ready",
  "notification.test",
] as const;

export const MAX_TELEGRAM_DESTINATIONS = 10;
const SESSION_TTL_MS = 30 * 60 * 1000;

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

/**
 * Telegram start payloads only allow A–Z, a–z, 0–9, _ and - (max 64 chars).
 * Prefer lowercase hex so clients never mangle case-sensitive base64url.
 */
function createConnectToken() {
  return randomBytes(16).toString("hex");
}

function buildDeepLink(botUsername: string, token: string) {
  const user = botUsername.replace(/^@/, "").trim();
  // Telegram start payload must stay unencoded in practice for some clients;
  // hex tokens need no encoding. Keep encodeURIComponent for safety.
  return `https://t.me/${user}?start=${encodeURIComponent(token)}`;
}

/** Extract /start payload from Telegram message text. */
export function parseTelegramStartPayload(text: string): string | null {
  const trimmed = text.trim();
  // /start PAYLOAD  |  /start@BotName PAYLOAD
  const match = trimmed.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(.+))?$/i);
  if (!match) return null;
  const payload = (match[1] ?? "").trim();
  return payload || null;
}

async function findConnectSessionByToken(db: PlatformDb, token: string) {
  const normalized = token.trim();
  if (!normalized) return null;
  const [session] = await db
    .select()
    .from(telegramConnectSessions)
    .where(eq(telegramConnectSessions.token, normalized))
    .limit(1);
  return session ?? null;
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

export type TelegramConnectServiceOptions = {
  /**
   * When /start payload is op_<token>, hand off to operator link flow.
   * Keeps notification connect and shop-tools identity separate.
   */
  consumeOperatorStart?: (input: {
    startPayload: string;
    chatId: string;
    telegramUserId: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }) => Promise<{ handled: boolean; reason?: string }>;
  /** Inline button callbacks (order mark paid / details / tools). */
  handleCallbackQuery?: (update: unknown) => Promise<{ handled: boolean; reason?: string }>;
  /**
   * Linked-operator text handling: /menu, wizards, etc.
   * Return handled=false to fall through to default connect help.
   */
  handleToolsMessage?: (input: {
    chatId: string;
    telegramUserId: string;
    text: string;
    contact?: { phone?: string | null; firstName?: string | null; lastName?: string | null } | null;
  }) => Promise<{ handled: boolean; reason?: string }>;
};

export function createTelegramConnectService(
  db: PlatformDb,
  config: TelegramConnectConfig | null,
  serviceOptions?: TelegramConnectServiceOptions,
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

      // Cancel only this user's prior pending links (avoid killing other staff's links).
      await db
        .update(telegramConnectSessions)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(telegramConnectSessions.tenantId, input.tenantId),
            eq(telegramConnectSessions.createdByUserId, input.userId),
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

      if (
        "callback_query" in update &&
        (update as { callback_query?: unknown }).callback_query != null &&
        serviceOptions?.handleCallbackQuery
      ) {
        try {
          return await serviceOptions.handleCallbackQuery(update);
        } catch {
          return { handled: true as const, reason: "callback_error" as const };
        }
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

      const fromUser = typeof from === "object" && from !== null ? from : null;
      const telegramUserId =
        fromUser && typeof (fromUser as { id?: unknown }).id !== "undefined"
          ? String((fromUser as { id: unknown }).id)
          : chatId;

      // Tools / menu / wizards / contact share for linked operators.
      if (serviceOptions?.handleToolsMessage) {
        const contactRaw =
          typeof message === "object" &&
          message !== null &&
          "contact" in (message as object)
            ? (message as { contact?: unknown }).contact
            : null;
        const contactObj =
          contactRaw && typeof contactRaw === "object"
            ? (contactRaw as {
                phone_number?: unknown;
                first_name?: unknown;
                last_name?: unknown;
              })
            : null;
        const contact = contactObj
          ? {
              phone: typeof contactObj.phone_number === "string" ? contactObj.phone_number : null,
              firstName: typeof contactObj.first_name === "string" ? contactObj.first_name : null,
              lastName: typeof contactObj.last_name === "string" ? contactObj.last_name : null,
            }
          : null;

        // Contact-only messages may have empty text.
        const toolsText =
          typeof text === "string" && text.trim()
            ? text
            : contact
              ? "contact"
              : "";

        if (toolsText || contact) {
          const tools = await serviceOptions.handleToolsMessage({
            chatId,
            telegramUserId,
            text: toolsText,
            contact,
          });
          if (tools.handled) {
            return { handled: true as const, reason: tools.reason ?? "tools" };
          }
        }
      }

      if (typeof text !== "string") {
        return { handled: false as const, reason: "no_text" as const };
      }

      if (!text.startsWith("/start")) {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId,
          text: "Connect alerts under Settings → Notifications.\nLink shop tools under Settings → Telegram, then use the bot keyboard.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "help" as const };
      }

      const token = parseTelegramStartPayload(text);
      if (!token) {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId,
          text: "Open a fresh link from the dashboard to connect, or send Menu if you already linked tools.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "missing_token" as const };
      }

      // Operator shop-tools link: /start op_<token>
      if (token.startsWith("op_")) {
        if (!serviceOptions?.consumeOperatorStart) {
          await sendTelegramBotMessage({
            botToken: config.botToken,
            chatId,
            text: "Shop management links are not available right now. Please try again later from the dashboard.",
          }).catch(() => undefined);
          return { handled: true as const, reason: "operator_unavailable" as const };
        }
        const fromUser = typeof from === "object" && from !== null ? from : null;
        const telegramUserIdRaw =
          fromUser && typeof (fromUser as { id?: unknown }).id !== "undefined"
            ? String((fromUser as { id: unknown }).id)
            : chatId;
        try {
          return await serviceOptions.consumeOperatorStart({
            startPayload: token,
            chatId,
            telegramUserId: telegramUserIdRaw,
            username:
              fromUser && typeof (fromUser as { username?: unknown }).username === "string"
                ? String((fromUser as { username: string }).username)
                : null,
            firstName:
              fromUser && typeof (fromUser as { first_name?: unknown }).first_name === "string"
                ? String((fromUser as { first_name: string }).first_name)
                : null,
            lastName:
              fromUser && typeof (fromUser as { last_name?: unknown }).last_name === "string"
                ? String((fromUser as { last_name: string }).last_name)
                : null,
          });
        } catch {
          await sendTelegramBotMessage({
            botToken: config.botToken,
            chatId,
            text: "Could not finish linking shop management. Request a new link from the dashboard and try again.",
          }).catch(() => undefined);
          return { handled: true as const, reason: "operator_error" as const };
        }
      }

      const session = await findConnectSessionByToken(db, token);
      const nowMs = Date.now();

      if (!session) {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId,
          text: "This link is no longer valid. In your dashboard, choose Connect Telegram again and open the new link right away.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "invalid_token" as const };
      }

      if (session.status === "consumed") {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId,
          text: "This chat is already connected. You can manage alert settings in the dashboard.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "already_consumed" as const };
      }

      if (session.status !== "pending" || session.expiresAt.getTime() <= nowMs) {
        if (session.status === "pending") {
          await db
            .update(telegramConnectSessions)
            .set({ status: "expired" })
            .where(eq(telegramConnectSessions.id, session.id));
        }
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId,
          text: "This link has expired. In your dashboard, choose Connect Telegram again for a fresh link.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "expired_token" as const };
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
