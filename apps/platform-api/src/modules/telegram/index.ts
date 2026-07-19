/**
 * Telegram merchant surface: alerts connect, operator identity, and shop tools.
 * Low-level Bot API send helpers stay in notifications/providers (shared with delivery).
 */

export {
  createTelegramCallbackSecret,
  resolveTelegramCallbackSecret,
  handleTelegramCallbackQuery,
} from "./telegram-actions.js";
export { setDefaultBotCommands, setOperatorChatCommands, deleteChatBotCommands } from "./telegram-bot-commands.js";
export { createTelegramConnectService, parseTelegramStartPayload } from "./telegram-connect.js";
export { createTelegramOperatorService } from "./telegram-operator.js";
export { startTelegramPolling } from "./telegram-polling.js";
export {
  handleTelegramToolsCallback,
  handleTelegramToolsMessage,
  type TelegramToolsDeps,
} from "./telegram-tools.js";
