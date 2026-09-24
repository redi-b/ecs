import {
  editTelegramMessageText,
  sendTelegramBotMessage,
} from "../notifications/providers/telegram-provider.js";
import type { TelegramDialogState } from "./telegram-dialog-state.js";
import type { TelegramOperatorContext, TelegramToolsDeps } from "./telegram-tools-contract.js";

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function dialogBase(
  ctx: TelegramOperatorContext,
  flow: TelegramDialogState["flow"],
  step: TelegramDialogState["step"],
): Omit<TelegramDialogState, "expiresAt"> {
  return {
    flow,
    step,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    salesChannelId: ctx.salesChannelId,
    stockLocationId: ctx.stockLocationId,
    regionId: ctx.regionId,
    shippingOptionId: ctx.shippingOptionId,
  };
}

export async function sendOrEdit(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    messageId: number | null;
    text: string;
    parseMode?: "HTML";
    replyMarkup?: unknown;
  },
) {
  if (input.messageId != null) {
    const edited = await editTelegramMessageText({
      botToken: deps.botToken,
      chatId: input.chatId,
      messageId: input.messageId,
      text: input.text,
      ...(input.parseMode ? { parseMode: input.parseMode } : {}),
      ...(input.replyMarkup != null ? { replyMarkup: input.replyMarkup } : {}),
    })
      .then(() => true)
      .catch(() => false);
    if (edited) return;
  }
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: input.text,
    ...(input.parseMode ? { parseMode: input.parseMode } : {}),
    ...(input.replyMarkup != null ? { replyMarkup: input.replyMarkup } : {}),
  }).catch(() => undefined);
}
