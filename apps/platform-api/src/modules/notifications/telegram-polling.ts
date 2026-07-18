/**
 * Local-dev Telegram updates via long polling.
 * Required when the bot webhook still points at production (or any non-local host):
 * connect sessions live in the local DB, so webhook hits never match.
 *
 * Enable with TELEGRAM_POLLING=1. Deletes any webhook first (Telegram allows only one mode).
 */

type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

export async function startTelegramPolling(options: {
  botToken: string;
  handleUpdate: (update: unknown) => Promise<unknown>;
  logger: Logger;
  /** Abort when process shuts down. */
  signal?: AbortSignal;
}) {
  const token = options.botToken.trim();
  if (!token) return;

  const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`;

  try {
    const del = await fetch(api("deleteWebhook"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    const delBody = (await del.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!del.ok || !delBody?.ok) {
      options.logger.warn(
        { description: delBody?.description },
        "Telegram deleteWebhook failed; polling may not receive updates while a webhook is active",
      );
    } else {
      options.logger.info("Telegram webhook cleared; using long polling for local connect");
    }
  } catch (error) {
    options.logger.warn({ error }, "Telegram deleteWebhook request failed");
  }

  let offset = 0;
  const poll = async () => {
    while (!options.signal?.aborted) {
      try {
        const response = await fetch(api("getUpdates"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            offset,
            timeout: 25,
            allowed_updates: ["message", "callback_query"],
          }),
          ...(options.signal ? { signal: options.signal } : {}),
        });
        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          result?: Array<{ update_id: number } & Record<string, unknown>>;
          description?: string;
        } | null;

        if (!response.ok || !data?.ok || !Array.isArray(data.result)) {
          options.logger.warn(
            { status: response.status, description: data?.description },
            "Telegram getUpdates failed; retrying",
          );
          await sleep(2000, options.signal);
          continue;
        }

        for (const update of data.result) {
          offset = update.update_id + 1;
          try {
            await options.handleUpdate(update);
          } catch (error) {
            options.logger.error({ error, update_id: update.update_id }, "Telegram update handler failed");
          }
        }
      } catch (error) {
        if (options.signal?.aborted) return;
        options.logger.warn({ error }, "Telegram polling error; retrying");
        await sleep(2000, options.signal);
      }
    }
  };

  void poll();
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}
