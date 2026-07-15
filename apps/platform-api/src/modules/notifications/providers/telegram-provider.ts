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

      const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: input.recipient,
          text: input.body.slice(0, 4000),
          disable_web_page_preview: true,
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
  fetchImpl?: typeof fetch;
}): Promise<void> {
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
      }),
    },
  );
  const data = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `telegram_http_${response.status}`);
  }
}
