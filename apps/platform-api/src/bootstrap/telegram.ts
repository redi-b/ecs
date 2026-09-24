import type { createPlatformDb } from "@ecs/db";
import type { createLogger } from "@ecs/logger";
import {
  handleTelegramCallbackQuery,
  resolveTelegramCallbackSecret,
  type TelegramActionsDeps,
} from "../modules/telegram/telegram-actions.js";
import { setDefaultBotCommands } from "../modules/telegram/telegram-bot-commands.js";
import { createTelegramConnectService } from "../modules/telegram/telegram-connect.js";
import { createTelegramOperatorService } from "../modules/telegram/telegram-operator.js";
import { startTelegramPolling } from "../modules/telegram/telegram-polling.js";
import {
  handleTelegramToolsCallback,
  handleTelegramToolsMessage,
  type TelegramToolsDeps,
} from "../modules/telegram/telegram-tools.js";
import { ensureTelegramWebhookIfConfigured } from "../modules/telegram/telegram-webhook.js";

type TelegramBootstrapOptions = {
  db: ReturnType<typeof createPlatformDb>["db"];
  env: NodeJS.ProcessEnv;
  logger: ReturnType<typeof createLogger>;
};

type TelegramOrderHandlers = Pick<TelegramActionsDeps, "getMerchantOrder" | "mutateMerchantOrder">;

type TelegramCommerceTools = Omit<
  TelegramToolsDeps,
  "botToken" | "callbackSecret" | "dashboardPublicBaseUrl" | "db" | "operatorService"
>;

export function createTelegramRuntime(options: TelegramBootstrapOptions) {
  const botToken = options.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  const botUsername = options.env.TELEGRAM_BOT_USERNAME?.trim() || "";
  const webhookSecret = options.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";
  const botConfig = botToken && botUsername ? { botToken, botUsername } : null;
  const operatorService = createTelegramOperatorService(options.db, botConfig);
  const callbackSecret = resolveTelegramCallbackSecret();
  const orderBridge: { handlers: TelegramOrderHandlers | null } = { handlers: null };
  const toolsBridge: { deps: TelegramToolsDeps | null } = { deps: null };

  const connectService = createTelegramConnectService(options.db, botConfig, {
    consumeOperatorStart: (input) => operatorService.consumeOperatorStart(input),
    handleCallbackQuery: async (update) => {
      if (!botToken) {
        return { handled: true, reason: "actions_unavailable" };
      }
      if (toolsBridge.deps) {
        const tools = await handleTelegramToolsCallback(toolsBridge.deps, update);
        if (tools.handled) return tools;
      }
      if (!orderBridge.handlers) {
        return { handled: true, reason: "actions_unavailable" };
      }
      return handleTelegramCallbackQuery(
        {
          db: options.db,
          botToken,
          operatorService,
          ...orderBridge.handlers,
          secret: callbackSecret,
        },
        update,
      );
    },
    handleToolsMessage: async (input) => {
      if (!toolsBridge.deps) {
        return { handled: false, reason: "tools_unavailable" };
      }
      return handleTelegramToolsMessage(toolsBridge.deps, input);
    },
  });
  const pollingEnabled =
    options.env.TELEGRAM_POLLING === "1" ||
    options.env.TELEGRAM_POLLING?.toLowerCase() === "true" ||
    (options.env.NODE_ENV === "development" &&
      options.env.TELEGRAM_POLLING !== "0" &&
      options.env.TELEGRAM_POLLING?.toLowerCase() !== "false");

  if (connectService.isConfigured()) {
    options.logger.info(
      { bot: botUsername, polling: pollingEnabled },
      "Telegram bot configured for notifications and shop tools.",
    );
    if (botToken) {
      void setDefaultBotCommands({ botToken }).catch((err) => {
        options.logger.warn({ err }, "Telegram default bot commands could not be registered");
      });
      void ensureTelegramWebhookIfConfigured({
        botToken,
        pollingEnabled,
        env: {
          TELEGRAM_WEBHOOK_URL: options.env.TELEGRAM_WEBHOOK_URL,
          PLATFORM_PUBLIC_BASE_URL: options.env.PLATFORM_PUBLIC_BASE_URL,
          TELEGRAM_WEBHOOK_SECRET: options.env.TELEGRAM_WEBHOOK_SECRET,
        },
        logger: options.logger,
      }).then((result) => {
        if ("skipped" in result && result.skipped) {
          if (result.reason === "webhook_url_unconfigured" && !pollingEnabled) {
            options.logger.warn(
              "Telegram webhook URL is not set; connect stays unavailable until it points at this process.",
            );
          }
          return;
        }
        if ("ok" in result && !result.ok) {
          options.logger.warn({ error: result.error }, "Telegram webhook registration failed");
        }
      });
    }
  } else {
    options.logger.warn("TELEGRAM_BOT_TOKEN/USERNAME not set; Telegram connect stays unavailable.");
  }

  return {
    appOptions: {
      listTelegramDestinations: connectService.listDestinations,
      createTelegramConnectSession: connectService.createConnectSession,
      getTelegramConnectSession: connectService.getConnectSession,
      cancelTelegramConnectSession: connectService.cancelConnectSession,
      removeTelegramDestination: connectService.removeDestination,
      setTelegramDestinationEnabled: connectService.setDestinationEnabled,
      setTelegramSharedEvents: connectService.setSharedEvents,
      listTelegramOperatorBindings: operatorService.listBindings,
      createTelegramOperatorLinkSession: operatorService.createLinkSession,
      getTelegramOperatorLinkSession: operatorService.getLinkSession,
      cancelTelegramOperatorLinkSession: operatorService.cancelLinkSession,
      removeTelegramOperatorBinding: operatorService.removeBinding,
      setTelegramOperatorBindingEnabled: operatorService.setBindingEnabled,
      isTelegramOperatorChatForActions: operatorService.isOperatorChatForActions,
      handleTelegramWebhook: connectService.handleWebhookUpdate,
      telegramWebhookSecret: webhookSecret || undefined,
    },
    connectService,
    isConfigured: connectService.isConfigured(),
    operatorService,
    pollingEnabled,
    setCommerceTools(deps: TelegramCommerceTools) {
      if (!botToken) return;
      toolsBridge.deps = {
        ...deps,
        botToken,
        callbackSecret,
        dashboardPublicBaseUrl: options.env.DASHBOARD_PUBLIC_BASE_URL ?? null,
        db: options.db,
        operatorService,
      };
    },
    setOrderHandlers(handlers: TelegramOrderHandlers) {
      orderBridge.handlers = handlers;
    },
    startPolling(signal: AbortSignal) {
      if (!connectService.isConfigured() || !pollingEnabled || !botToken) return;
      void startTelegramPolling({
        botToken,
        handleUpdate: (update) => connectService.handleWebhookUpdate(update),
        logger: options.logger,
        signal,
      });
    },
    webhookSecret: webhookSecret || undefined,
  };
}
