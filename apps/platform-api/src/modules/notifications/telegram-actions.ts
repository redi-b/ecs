import type { createPlatformDb } from "@ecs/db";
import { tenants } from "@ecs/db";
import { eq } from "drizzle-orm";

import type { MerchantOrderActionResult } from "../../types/index.js";
import {
  createTelegramCallbackSecret,
  parseOrderActionCallbackData,
} from "./telegram-callback-tokens.js";
import type { TelegramOperatorService } from "./telegram-operator.js";
import { formatMoneyAmount, formatOrderRef } from "./renderer.js";
import {
  answerTelegramCallbackQuery,
  editTelegramMessageReplyMarkup,
  sendTelegramBotMessage,
} from "./providers/telegram-provider.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type TelegramActionsDeps = {
  db: PlatformDb;
  botToken: string;
  operatorService: TelegramOperatorService;
  mutateMerchantOrder: (input: {
    action: "mark-paid";
    orderId: string;
    salesChannelId: string;
  }) => Promise<MerchantOrderActionResult>;
  getMerchantOrder?: (input: {
    orderId: string;
    salesChannelId: string;
  }) => Promise<MerchantOrderActionResult>;
  secret: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * Handle Telegram callback_query for order alert actions.
 */
export async function handleTelegramCallbackQuery(
  deps: TelegramActionsDeps,
  update: unknown,
): Promise<{ handled: boolean; reason?: string }> {
  const root = asRecord(update);
  const callback = root ? asRecord(root.callback_query) : null;
  if (!callback) return { handled: false, reason: "no_callback" };

  const callbackId = typeof callback.id === "string" ? callback.id : null;
  const data = typeof callback.data === "string" ? callback.data : null;
  const from = asRecord(callback.from);
  const message = asRecord(callback.message);
  const chat = message ? asRecord(message.chat) : null;
  const chatId = chat?.id != null ? String(chat.id) : null;
  const messageId = typeof message?.message_id === "number" ? message.message_id : null;
  const telegramUserId = from?.id != null ? String(from.id) : null;

  if (!callbackId || !data || !telegramUserId || !chatId) {
    return { handled: true, reason: "incomplete_callback" };
  }

  const { operators } = await deps.operatorService.resolveOperator({ telegramUserId });
  if (operators.length === 0) {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "This Telegram account is not linked for shop management.",
      showAlert: true,
    }).catch(() => undefined);
    return { handled: true, reason: "not_operator" };
  }

  const tenantIds = [...new Set(operators.map((op) => op.tenantId))];
  const parsed = parseOrderActionCallbackData(data, {
    secret: deps.secret,
    tenantIds,
  });

  if (!parsed.ok) {
    const text =
      parsed.reason === "expired"
        ? "This action has expired. Open the order in the dashboard."
        : "This action is no longer valid.";
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text,
      showAlert: true,
    }).catch(() => undefined);
    return { handled: true, reason: parsed.reason };
  }

  const operator = operators.find((op) => op.tenantId === parsed.tenantId);
  if (!operator) {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "You do not have access for this shop.",
      showAlert: true,
    }).catch(() => undefined);
    return { handled: true, reason: "tenant_mismatch" };
  }

  const [tenant] = await deps.db
    .select({
      medusaSalesChannelId: tenants.medusaSalesChannelId,
      name: tenants.name,
    })
    .from(tenants)
    .where(eq(tenants.id, parsed.tenantId))
    .limit(1);

  const salesChannelId = tenant?.medusaSalesChannelId?.trim();
  if (!salesChannelId) {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Shop commerce is not fully set up yet.",
      showAlert: true,
    }).catch(() => undefined);
    return { handled: true, reason: "no_sales_channel" };
  }

  if (parsed.action === "details") {
    let text = `Order ${formatOrderRef(parsed.orderId)}`;
    if (deps.getMerchantOrder) {
      const detail = await deps.getMerchantOrder({
        orderId: parsed.orderId,
        salesChannelId,
      });
      if (detail.ok) {
        const order = detail.order;
        const lines = [
          `<b>Order ${formatOrderRef(order.id)}</b>`,
          order.total != null
            ? `Total: ${formatMoneyAmount(String(order.total), order.currencyCode ?? undefined) ?? order.total}`
            : null,
          order.paymentStatus ? `Payment: ${order.paymentStatus}` : null,
          order.fulfillmentStatus ? `Fulfillment: ${order.fulfillmentStatus}` : null,
          order.delivery?.customerName || order.shippingAddress?.firstName
            ? `Customer: ${
                order.delivery?.customerName ||
                [order.shippingAddress?.firstName, order.shippingAddress?.lastName]
                  .filter(Boolean)
                  .join(" ")
              }`
            : null,
          order.delivery?.customerPhone || order.shippingAddress?.phone
            ? `Phone: ${order.delivery?.customerPhone || order.shippingAddress?.phone}`
            : null,
        ].filter(Boolean);
        text = lines.join("\n");
      }
    }
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text,
      parseMode: text.includes("<b>") ? "HTML" : undefined,
    }).catch(() => undefined);
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Order details",
    }).catch(() => undefined);
    return { handled: true, reason: "details" };
  }

  // mark paid
  const result = await deps.mutateMerchantOrder({
    action: "mark-paid",
    orderId: parsed.orderId,
    salesChannelId,
  });

  if (!result.ok) {
    const msg =
      result.error === "order_not_found"
        ? "Order not found for this shop."
        : "Could not mark this order as paid. Try again from the dashboard.";
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: msg,
      showAlert: true,
    }).catch(() => undefined);
    return { handled: true, reason: result.error };
  }

  await answerTelegramCallbackQuery({
    botToken: deps.botToken,
    callbackQueryId: callbackId,
    text: `Marked paid · ${formatOrderRef(parsed.orderId)}`,
  }).catch(() => undefined);

  if (messageId != null) {
    await editTelegramMessageReplyMarkup({
      botToken: deps.botToken,
      chatId,
      messageId,
      replyMarkup: { inline_keyboard: [] },
    }).catch(() => undefined);
  }

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: `Payment marked for order ${formatOrderRef(parsed.orderId)}.`,
  }).catch(() => undefined);

  void operator;
  return { handled: true, reason: "paid" };
}

export function resolveTelegramCallbackSecret() {
  return createTelegramCallbackSecret(process.env);
}
