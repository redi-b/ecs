import type { NotificationProvider, SendNotificationInput, SendNotificationResult } from "./types.js";

export type CreateTelegramProviderOptions = {
  botToken: string;
  /** Optional fetch override for tests. */
  fetchImpl?: typeof fetch;
};

/**
 * Real Telegram Bot API delivery. recipient = chat_id.
 */
export function createTelegramNotificationProvider(
  options: CreateTelegramProviderOptions,
): NotificationProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const botToken = options.botToken.trim();

  return {
    channel: "telegram",
    async send(input: SendNotificationInput): Promise<SendNotificationResult> {
      if (!botToken) {
        throw new Error("telegram_bot_token_missing");
      }

      const rich = input.html?.trim();
      const text = (rich || input.body).slice(0, 4000);
      const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: input.recipient,
          text,
          disable_web_page_preview: true,
          ...(rich ? { parse_mode: "HTML" as const } : {}),
          ...(input.replyMarkup != null ? { reply_markup: input.replyMarkup } : {}),
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        result?: { message_id?: number };
        description?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.description || `telegram_http_${response.status}`);
      }

      const messageId = data.result?.message_id;
      return {
        providerReference:
          messageId != null ? `telegram:${input.recipient}:${messageId}` : `telegram:${input.recipient}`,
      };
    },
  };
}

export async function sendTelegramBotMessage(options: {
  botToken: string;
  chatId: string | number;
  text: string;
  parseMode?: "HTML" | undefined;
  replyMarkup?: unknown;
  fetchImpl?: typeof fetch;
}): Promise<{ messageId: number | null }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.telegram.org/bot${options.botToken.trim()}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: options.chatId,
        text: options.text.slice(0, 4000),
        disable_web_page_preview: true,
        ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
        ...(options.replyMarkup != null ? { reply_markup: options.replyMarkup } : {}),
      }),
    },
  );
  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  } | null;
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `telegram_http_${response.status}`);
  }
  return { messageId: data.result?.message_id ?? null };
}

export async function editTelegramMessageText(options: {
  botToken: string;
  chatId: string | number;
  messageId: number;
  text: string;
  parseMode?: "HTML" | undefined;
  replyMarkup?: unknown;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.telegram.org/bot${options.botToken.trim()}/editMessageText`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: options.chatId,
        message_id: options.messageId,
        text: options.text.slice(0, 4000),
        disable_web_page_preview: true,
        ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
        ...(options.replyMarkup != null ? { reply_markup: options.replyMarkup } : {}),
      }),
    },
  );
  const data = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `telegram_http_${response.status}`);
  }
}

export async function answerTelegramCallbackQuery(options: {
  botToken: string;
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.telegram.org/bot${options.botToken.trim()}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callback_query_id: options.callbackQueryId,
        ...(options.text ? { text: options.text.slice(0, 200) } : {}),
        ...(options.showAlert ? { show_alert: true } : {}),
      }),
    },
  );
  const data = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `telegram_http_${response.status}`);
  }
}

export async function editTelegramMessageReplyMarkup(options: {
  botToken: string;
  chatId: string | number;
  messageId: number;
  replyMarkup: unknown;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.telegram.org/bot${options.botToken.trim()}/editMessageReplyMarkup`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: options.chatId,
        message_id: options.messageId,
        reply_markup: options.replyMarkup,
      }),
    },
  );
  const data = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `telegram_http_${response.status}`);
  }
}
