/**
 * Register or clear the Telegram Bot API webhook.
 * Production should set the webhook; local polling deletes it first.
 */

export type TelegramWebhookLogger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

/**
 * Prefer TELEGRAM_WEBHOOK_URL; else PLATFORM_PUBLIC_BASE_URL + /platform/webhooks/telegram.
 */
export function resolveTelegramWebhookUrl(env: {
  TELEGRAM_WEBHOOK_URL?: string | undefined;
  PLATFORM_PUBLIC_BASE_URL?: string | undefined;
}): string | null {
  const explicit = env.TELEGRAM_WEBHOOK_URL?.trim();
  if (explicit) {
    try {
      const url = new URL(explicit);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      return url.href.replace(/\/$/, "");
    } catch {
      return null;
    }
  }

  const base = env.PLATFORM_PUBLIC_BASE_URL?.trim();
  if (!base) return null;
  try {
    const root = base.endsWith("/") ? base : `${base}/`;
    return new URL("platform/webhooks/telegram", root).href;
  } catch {
    return null;
  }
}

export async function setTelegramWebhook(options: {
  botToken: string;
  webhookUrl: string;
  /** Matches X-Telegram-Bot-Api-Secret-Token when Telegram delivers updates. */
  secretToken?: string | null;
  fetchImpl?: typeof fetch;
  logger?: TelegramWebhookLogger;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const token = options.botToken.trim();
  const webhookUrl = options.webhookUrl.trim();
  if (!token) return { ok: false, error: "telegram_bot_token_missing" };
  if (!webhookUrl) return { ok: false, error: "telegram_webhook_url_missing" };

  const fetchImpl = options.fetchImpl ?? fetch;
  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  };
  const secret = options.secretToken?.trim();
  if (secret) {
    body.secret_token = secret;
  }

  try {
    const response = await fetchImpl(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;
    if (!response.ok || !data?.ok) {
      const error = data?.description || `telegram_setWebhook_${response.status}`;
      options.logger?.warn({ error, webhookUrl }, "Telegram setWebhook failed");
      return { ok: false, error };
    }
    options.logger?.info({ webhookUrl }, "Telegram webhook registered");
    return { ok: true, url: webhookUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "telegram_setWebhook_failed";
    options.logger?.warn({ error: message, webhookUrl }, "Telegram setWebhook request failed");
    return { ok: false, error: message };
  }
}

/**
 * When polling is off and a public webhook URL is known, register it with Telegram.
 * Safe to call on every boot (idempotent).
 */
export async function ensureTelegramWebhookIfConfigured(options: {
  botToken: string;
  env: {
    TELEGRAM_WEBHOOK_URL?: string | undefined;
    PLATFORM_PUBLIC_BASE_URL?: string | undefined;
    TELEGRAM_WEBHOOK_SECRET?: string | undefined;
  };
  pollingEnabled: boolean;
  fetchImpl?: typeof fetch;
  logger?: TelegramWebhookLogger;
}): Promise<{ skipped: true; reason: string } | { ok: true; url: string } | { ok: false; error: string }> {
  if (options.pollingEnabled) {
    return { skipped: true, reason: "polling_enabled" };
  }
  const webhookUrl = resolveTelegramWebhookUrl(options.env);
  if (!webhookUrl) {
    return { skipped: true, reason: "webhook_url_unconfigured" };
  }
  // Telegram requires HTTPS for webhooks except localhost.
  try {
    const host = new URL(webhookUrl).hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".lvh.me");
    if (!webhookUrl.startsWith("https://") && !isLocal) {
      options.logger?.warn(
        { webhookUrl },
        "Telegram webhook URL is not HTTPS; Telegram will reject non-local HTTP webhooks",
      );
    }
  } catch {
    return { ok: false, error: "telegram_webhook_url_invalid" };
  }

  const result = await setTelegramWebhook({
    botToken: options.botToken,
    webhookUrl,
    secretToken: options.env.TELEGRAM_WEBHOOK_SECRET ?? null,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.logger ? { logger: options.logger } : {}),
  });
  return result;
}
