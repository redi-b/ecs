const API = (token: string) => `https://api.telegram.org/bot${token.trim()}`;

export const DEFAULT_BOT_COMMANDS = [
  { command: "start", description: "Open the bot" },
  { command: "help", description: "How to use" },
] as const;

export const OPERATOR_BOT_COMMANDS = [
  { command: "start", description: "Open shop tools" },
  { command: "menu", description: "Shop menu" },
  { command: "sale", description: "New offline sale" },
  { command: "stock", description: "Update stock" },
  { command: "today", description: "Today’s summary" },
  { command: "orders", description: "Recent orders" },
  { command: "shop", description: "Shop details & unlink" },
  { command: "help", description: "How to use" },
  { command: "cancel", description: "Cancel current step" },
] as const;

async function telegramOk(
  response: Response,
  data: { ok?: boolean; description?: string } | null,
  label: string,
) {
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `${label}_${response.status}`);
  }
}

export async function setDefaultBotCommands(options: {
  botToken: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${API(options.botToken)}/setMyCommands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      commands: DEFAULT_BOT_COMMANDS,
      scope: { type: "default" },
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
  } | null;
  await telegramOk(response, data, "telegram_setMyCommands");
}

export async function setOperatorChatCommands(options: {
  botToken: string;
  chatId: string | number;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${API(options.botToken)}/setMyCommands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      commands: OPERATOR_BOT_COMMANDS,
      scope: { type: "chat", chat_id: options.chatId },
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
  } | null;
  await telegramOk(response, data, "telegram_setMyCommands_chat");
}

export async function deleteChatBotCommands(options: {
  botToken: string;
  chatId: string | number;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${API(options.botToken)}/deleteMyCommands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scope: { type: "chat", chat_id: options.chatId },
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
  } | null;
  await telegramOk(response, data, "telegram_deleteMyCommands");
}
