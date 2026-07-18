import { randomBytes } from "node:crypto";
import type { createPlatformDb } from "@ecs/db";
import {
  telegramOperatorBindings,
  telegramOperatorLinkSessions,
  tenantMemberships,
  tenants,
} from "@ecs/db";
import { and, desc, eq, or } from "drizzle-orm";

import { sendTelegramBotMessage } from "./providers/telegram-provider.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type TelegramConnectConfig = {
  botToken: string;
  botUsername: string;
};

const SESSION_TTL_MS = 30 * 60 * 1000;
/** Deep-link payload prefix: /start op_<token> */
export const OPERATOR_START_PREFIX = "op_";

export const OPERATOR_WRITE_ROLES = ["owner", "manager"] as const;

export type TelegramOperatorBindingView = {
  id: string;
  label: string;
  username: string | null;
  enabled: boolean;
  telegramUserId: string;
  linkedAt: string;
};

/** Lowercase hex only — safe for Telegram start payloads (64 char max). */
function createToken() {
  return randomBytes(16).toString("hex");
}

function buildOperatorDeepLink(botUsername: string, token: string) {
  const user = botUsername.replace(/^@/, "").trim();
  return `https://t.me/${user}?start=${encodeURIComponent(`${OPERATOR_START_PREFIX}${token}`)}`;
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
  if (name) return name;
  return `Telegram ${input.chatId.slice(-4)}`;
}

function serializeBinding(
  row: typeof telegramOperatorBindings.$inferSelect,
): TelegramOperatorBindingView {
  return {
    id: row.id,
    label: row.label,
    username: row.username,
    enabled: row.enabled,
    telegramUserId: row.telegramUserId,
    linkedAt: row.createdAt.toISOString(),
  };
}

async function getActiveWriteMembership(
  db: PlatformDb,
  input: { tenantId: string; userId: string },
) {
  const [row] = await db
    .select({
      role: tenantMemberships.role,
      status: tenantMemberships.status,
    })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, input.tenantId),
        eq(tenantMemberships.userId, input.userId),
      ),
    )
    .limit(1);

  if (!row || row.status !== "active") {
    return null;
  }
  if (!OPERATOR_WRITE_ROLES.includes(row.role as (typeof OPERATOR_WRITE_ROLES)[number])) {
    return null;
  }
  return row;
}

export function createTelegramOperatorService(
  db: PlatformDb,
  config: TelegramConnectConfig | null,
) {
  return {
    isConfigured: () => Boolean(config?.botToken && config?.botUsername),

    listBindings: async (input: { tenantId: string }) => {
      const rows = await db
        .select()
        .from(telegramOperatorBindings)
        .where(eq(telegramOperatorBindings.tenantId, input.tenantId))
        .orderBy(desc(telegramOperatorBindings.createdAt));
      return { bindings: rows.map(serializeBinding) };
    },

    createLinkSession: async (input: { tenantId: string; userId: string }) => {
      if (!config?.botToken || !config.botUsername) {
        return {
          ok: false as const,
          error: "telegram_not_configured" as const,
          status: 503 as const,
        };
      }

      const membership = await getActiveWriteMembership(db, input);
      if (!membership) {
        return {
          ok: false as const,
          error: "telegram_operator_forbidden" as const,
          status: 403 as const,
        };
      }

      await db
        .update(telegramOperatorLinkSessions)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(telegramOperatorLinkSessions.tenantId, input.tenantId),
            eq(telegramOperatorLinkSessions.userId, input.userId),
            eq(telegramOperatorLinkSessions.status, "pending"),
          ),
        );

      const token = createToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      const [session] = await db
        .insert(telegramOperatorLinkSessions)
        .values({
          token,
          tenantId: input.tenantId,
          userId: input.userId,
          status: "pending",
          expiresAt,
        })
        .returning();

      if (!session) {
        throw new Error("Failed to create telegram operator link session");
      }

      return {
        ok: true as const,
        session: {
          id: session.id,
          status: session.status,
          expiresAt: session.expiresAt.toISOString(),
          deepLink: buildOperatorDeepLink(config.botUsername, token),
        },
      };
    },

    getLinkSession: async (input: { tenantId: string; sessionId: string }) => {
      const [session] = await db
        .select()
        .from(telegramOperatorLinkSessions)
        .where(
          and(
            eq(telegramOperatorLinkSessions.id, input.sessionId),
            eq(telegramOperatorLinkSessions.tenantId, input.tenantId),
          ),
        )
        .limit(1);

      if (!session) {
        return { ok: false as const, error: "session_not_found" as const, status: 404 as const };
      }

      let status = session.status;
      if (status === "pending" && session.expiresAt.getTime() <= Date.now()) {
        await db
          .update(telegramOperatorLinkSessions)
          .set({ status: "expired" })
          .where(eq(telegramOperatorLinkSessions.id, session.id));
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
              ? buildOperatorDeepLink(config.botUsername, session.token)
              : null,
        },
      };
    },

    cancelLinkSession: async (input: { tenantId: string; sessionId: string }) => {
      const [session] = await db
        .select()
        .from(telegramOperatorLinkSessions)
        .where(
          and(
            eq(telegramOperatorLinkSessions.id, input.sessionId),
            eq(telegramOperatorLinkSessions.tenantId, input.tenantId),
          ),
        )
        .limit(1);

      if (!session) {
        return { ok: false as const, error: "session_not_found" as const, status: 404 as const };
      }

      if (session.status === "pending") {
        await db
          .update(telegramOperatorLinkSessions)
          .set({ status: "cancelled" })
          .where(eq(telegramOperatorLinkSessions.id, session.id));
      }

      return { ok: true as const };
    },

    removeBinding: async (input: { tenantId: string; bindingId: string }) => {
      const deleted = await db
        .delete(telegramOperatorBindings)
        .where(
          and(
            eq(telegramOperatorBindings.id, input.bindingId),
            eq(telegramOperatorBindings.tenantId, input.tenantId),
          ),
        )
        .returning({ id: telegramOperatorBindings.id });

      if (deleted.length === 0) {
        return { ok: false as const, error: "binding_not_found" as const, status: 404 as const };
      }
      return { ok: true as const };
    },

    setBindingEnabled: async (input: {
      tenantId: string;
      bindingId: string;
      enabled: boolean;
    }) => {
      const [row] = await db
        .update(telegramOperatorBindings)
        .set({ enabled: input.enabled, updatedAt: new Date() })
        .where(
          and(
            eq(telegramOperatorBindings.id, input.bindingId),
            eq(telegramOperatorBindings.tenantId, input.tenantId),
          ),
        )
        .returning();

      if (!row) {
        return { ok: false as const, error: "binding_not_found" as const, status: 404 as const };
      }
      return { ok: true as const, binding: serializeBinding(row) };
    },

    /**
     * Whether this chat may receive write action buttons on alerts.
     * Private chats: chat_id matches telegram_user_id / telegram_chat_id.
     */
    isOperatorChatForActions: async (input: {
      tenantId: string;
      chatId: string;
    }) => {
      const [binding] = await db
        .select({
          id: telegramOperatorBindings.id,
          userId: telegramOperatorBindings.userId,
        })
        .from(telegramOperatorBindings)
        .where(
          and(
            eq(telegramOperatorBindings.tenantId, input.tenantId),
            eq(telegramOperatorBindings.enabled, true),
            or(
              eq(telegramOperatorBindings.telegramChatId, input.chatId),
              eq(telegramOperatorBindings.telegramUserId, input.chatId),
            ),
          ),
        )
        .limit(1);

      if (!binding) return { ok: true as const, allowed: false as const };

      const membership = await getActiveWriteMembership(db, {
        tenantId: input.tenantId,
        userId: binding.userId,
      });
      return { ok: true as const, allowed: Boolean(membership) };
    },

    resolveOperator: async (input: { telegramUserId: string }) => {
      const rows = await db
        .select({
          binding: telegramOperatorBindings,
          role: tenantMemberships.role,
          membershipStatus: tenantMemberships.status,
          tenantName: tenants.name,
          tenantHandle: tenants.handle,
        })
        .from(telegramOperatorBindings)
        .innerJoin(
          tenantMemberships,
          and(
            eq(tenantMemberships.tenantId, telegramOperatorBindings.tenantId),
            eq(tenantMemberships.userId, telegramOperatorBindings.userId),
          ),
        )
        .innerJoin(tenants, eq(tenants.id, telegramOperatorBindings.tenantId))
        .where(
          and(
            eq(telegramOperatorBindings.telegramUserId, input.telegramUserId),
            eq(telegramOperatorBindings.enabled, true),
          ),
        );

      const active = rows.filter(
        (row) =>
          row.membershipStatus === "active" &&
          OPERATOR_WRITE_ROLES.includes(row.role as (typeof OPERATOR_WRITE_ROLES)[number]),
      );

      return {
        operators: active.map((row) => ({
          bindingId: row.binding.id,
          tenantId: row.binding.tenantId,
          userId: row.binding.userId,
          role: row.role,
          tenantName: row.tenantName,
          tenantHandle: row.tenantHandle,
          telegramChatId: row.binding.telegramChatId,
        })),
      };
    },

    /**
     * Consume /start op_<token> from webhook. Caller already enforced private chat.
     */
    consumeOperatorStart: async (input: {
      startPayload: string;
      chatId: string;
      telegramUserId: string;
      username?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    }) => {
      if (!config?.botToken) {
        return { handled: false as const, reason: "not_configured" as const };
      }

      if (!input.startPayload.startsWith(OPERATOR_START_PREFIX)) {
        return { handled: false as const, reason: "not_operator_start" as const };
      }

      const token = input.startPayload.slice(OPERATOR_START_PREFIX.length).trim();
      if (!token) {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId: input.chatId,
          text: "This shop tools link is invalid. Open Settings in your dashboard and try again.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "missing_token" as const };
      }

      const [session] = await db
        .select()
        .from(telegramOperatorLinkSessions)
        .where(eq(telegramOperatorLinkSessions.token, token.trim()))
        .limit(1);

      if (!session) {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId: input.chatId,
          text: "This link is no longer valid. Open Settings → Telegram in your dashboard and create a new link.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "invalid_token" as const };
      }

      if (session.status === "consumed") {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId: input.chatId,
          text: "This Telegram account is already linked for shop management.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "already_consumed" as const };
      }

      if (session.status !== "pending" || session.expiresAt.getTime() <= Date.now()) {
        if (session.status === "pending") {
          await db
            .update(telegramOperatorLinkSessions)
            .set({ status: "expired" })
            .where(eq(telegramOperatorLinkSessions.id, session.id));
        }
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId: input.chatId,
          text: "This link has expired. Open Settings → Telegram in your dashboard for a fresh link.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "expired_token" as const };
      }

      const membership = await getActiveWriteMembership(db, {
        tenantId: session.tenantId,
        userId: session.userId,
      });
      if (!membership) {
        await db
          .update(telegramOperatorLinkSessions)
          .set({ status: "cancelled" })
          .where(eq(telegramOperatorLinkSessions.id, session.id));
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId: input.chatId,
          text: "You no longer have permission to manage this shop from Telegram.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "forbidden" as const };
      }

      const username = input.username?.replace(/^@/, "").trim() || null;
      const label = displayLabel({
        chatId: input.chatId,
        ...(username ? { username } : {}),
        ...(input.firstName != null ? { firstName: input.firstName } : {}),
        ...(input.lastName != null ? { lastName: input.lastName } : {}),
      });
      const now = new Date();

      // One binding per (tenant, user) and per (tenant, telegram user): upsert carefully.
      const [byUser] = await db
        .select()
        .from(telegramOperatorBindings)
        .where(
          and(
            eq(telegramOperatorBindings.tenantId, session.tenantId),
            eq(telegramOperatorBindings.userId, session.userId),
          ),
        )
        .limit(1);

      const [byTelegram] = await db
        .select()
        .from(telegramOperatorBindings)
        .where(
          and(
            eq(telegramOperatorBindings.tenantId, session.tenantId),
            eq(telegramOperatorBindings.telegramUserId, input.telegramUserId),
          ),
        )
        .limit(1);

      if (byTelegram && byTelegram.userId !== session.userId) {
        await sendTelegramBotMessage({
          botToken: config.botToken,
          chatId: input.chatId,
          text: "This Telegram account is already linked to another team member for this shop.",
        }).catch(() => undefined);
        return { handled: true as const, reason: "telegram_taken" as const };
      }

      if (byUser) {
        await db
          .update(telegramOperatorBindings)
          .set({
            telegramUserId: input.telegramUserId,
            telegramChatId: input.chatId,
            username,
            label,
            enabled: true,
            lastSeenAt: now,
            updatedAt: now,
          })
          .where(eq(telegramOperatorBindings.id, byUser.id));
      } else if (byTelegram) {
        await db
          .update(telegramOperatorBindings)
          .set({
            userId: session.userId,
            telegramChatId: input.chatId,
            username,
            label,
            enabled: true,
            lastSeenAt: now,
            updatedAt: now,
          })
          .where(eq(telegramOperatorBindings.id, byTelegram.id));
      } else {
        await db.insert(telegramOperatorBindings).values({
          tenantId: session.tenantId,
          userId: session.userId,
          telegramUserId: input.telegramUserId,
          telegramChatId: input.chatId,
          username,
          label,
          enabled: true,
          lastSeenAt: now,
          updatedAt: now,
        });
      }

      await db
        .update(telegramOperatorLinkSessions)
        .set({ status: "consumed", consumedAt: now })
        .where(eq(telegramOperatorLinkSessions.id, session.id));

      const [tenant] = await db
        .select({ name: tenants.name, handle: tenants.handle })
        .from(tenants)
        .where(eq(tenants.id, session.tenantId))
        .limit(1);

      const shopLabel = tenant?.name?.trim() || tenant?.handle || "your shop";

      await sendTelegramBotMessage({
        botToken: config.botToken,
        chatId: input.chatId,
        text: [
          `You are linked for shop management on ${shopLabel}.`,
          "",
          "Send Menu (or /menu) for Today, Stock, and Sale.",
          "For order alerts in this chat, also connect under Settings → Notifications.",
        ].join("\n"),
      }).catch(() => undefined);

      return { handled: true as const, reason: "linked" as const };
    },
  };
}

export type TelegramOperatorService = ReturnType<typeof createTelegramOperatorService>;
