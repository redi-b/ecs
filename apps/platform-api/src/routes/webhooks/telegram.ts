import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";

/**
 * Telegram Bot API webhook. Secret token header must match TELEGRAM_WEBHOOK_SECRET when set.
 */
export function registerTelegramWebhookRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  app.post("/platform/webhooks/telegram", async (context) => {
    if (!options.handleTelegramWebhook) {
      return context.json({ ok: true, skipped: true });
    }

    const expectedSecret = options.telegramWebhookSecret?.trim();
    if (expectedSecret) {
      const provided = context.req.header("x-telegram-bot-api-secret-token")?.trim();
      if (provided !== expectedSecret) {
        return context.json({ error: "webhook_unauthorized" }, 401);
      }
    }

    let update: unknown;
    try {
      update = await context.req.json();
    } catch {
      return context.json({ error: "invalid_json" }, 400);
    }

    await options.handleTelegramWebhook(update);
    // Always 200 to Telegram once authenticated so retries don't storm.
    return context.json({ ok: true });
  });
}
