import type { createPlatformDb } from "@ecs/db";
import { tenants } from "@ecs/db";
import { eq } from "drizzle-orm";

import type { MerchantOrder, MerchantOrderAction, MerchantOrderActionResult } from "../../types/index.js";
import {
  createTelegramCallbackSecret,
  parseOrderActionCallbackData,
  type TelegramOrderAction,
} from "./telegram-callback-tokens.js";
import type { TelegramOperatorService } from "./telegram-operator.js";
import { formatMoneyAmount, formatOrderRef, humanizeToken } from "./renderer.js";
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
    action: MerchantOrderAction;
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

function customerLabel(order: MerchantOrder): string | null {
  const name =
    order.delivery?.customerName?.trim() ||
    [order.shippingAddress?.firstName, order.shippingAddress?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
  return name || null;
}

function customerPhone(order: MerchantOrder): string | null {
  return order.delivery?.customerPhone?.trim() || order.shippingAddress?.phone?.trim() || null;
}

function formatOrderDetailsHtml(order: MerchantOrder): string {
  const ref = formatOrderRef(order.id);
  const lines = [
    `<b>Order ${ref}</b>`,
    order.total != null
      ? `Total: ${formatMoneyAmount(String(order.total), order.currencyCode ?? undefined) ?? order.total}`
      : null,
    order.paymentStatus ? `Payment: ${humanizeToken(order.paymentStatus)}` : null,
    order.paymentMethod ? `Method: ${humanizeToken(order.paymentMethod)}` : null,
    order.fulfillmentStatus ? `Status: ${humanizeToken(order.fulfillmentStatus)}` : null,
    order.delivery?.choice ? `Fulfillment: ${humanizeToken(order.delivery.choice)}` : null,
    customerLabel(order) ? `Customer: ${customerLabel(order)}` : null,
    customerPhone(order) ? `Phone: ${customerPhone(order)}` : null,
    order.shippingAddress?.city ? `City: ${order.shippingAddress.city}` : null,
  ].filter((line): line is string => Boolean(line));
  return lines.join("\n");
}

function mutationForAction(
  action: TelegramOrderAction,
): MerchantOrderAction | null {
  if (action === "paid") return "mark-paid";
  if (action === "ready") return "fulfill";
  if (action === "cancel") return "cancel";
  return null;
}

function successCopy(action: TelegramOrderAction, orderId: string): string {
  const ref = formatOrderRef(orderId);
  if (action === "paid") return `Marked paid · ${ref}`;
  if (action === "ready") return `Marked ready · ${ref}`;
  if (action === "cancel") return `Order cancelled · ${ref}`;
  return ref;
}

function failureCopy(action: TelegramOrderAction, error: string): string {
  if (error === "order_not_found") return "Order not found for this shop.";
  if (error === "order_not_fulfillable") {
    if (action === "ready") return "This order cannot be marked ready yet.";
    if (action === "paid") return "This order cannot be marked paid right now.";
    if (action === "cancel") return "This order cannot be cancelled right now.";
  }
  if (action === "paid") return "Could not mark paid. Try again from the dashboard.";
  if (action === "ready") return "Could not mark ready. Try again from the dashboard.";
  if (action === "cancel") return "Could not cancel this order. Try again from the dashboard.";
  return "Something went wrong. Try again from the dashboard.";
}

function followUpMessage(action: TelegramOrderAction, orderId: string): string {
  const ref = formatOrderRef(orderId);
  if (action === "paid") return `Payment recorded for order ${ref}.`;
  if (action === "ready") return `Order ${ref} is marked ready.`;
  if (action === "cancel") return `Order ${ref} was cancelled.`;
  return `Order ${ref}.`;
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
        text = formatOrderDetailsHtml(detail.order);
      } else {
        text = "Could not load this order. Open it in the dashboard.";
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

  const mutation = mutationForAction(parsed.action);
  if (!mutation) {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Unknown action.",
      showAlert: true,
    }).catch(() => undefined);
    return { handled: true, reason: "unknown_action" };
  }

  const result = await deps.mutateMerchantOrder({
    action: mutation,
    orderId: parsed.orderId,
    salesChannelId,
  });

  if (!result.ok) {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: failureCopy(parsed.action, result.error),
      showAlert: true,
    }).catch(() => undefined);
    return { handled: true, reason: result.error };
  }

  await answerTelegramCallbackQuery({
    botToken: deps.botToken,
    callbackQueryId: callbackId,
    text: successCopy(parsed.action, parsed.orderId),
  }).catch(() => undefined);

  // Destructive / terminal actions clear buttons so they are not double-tapped.
  if (messageId != null && (parsed.action === "paid" || parsed.action === "cancel")) {
    await editTelegramMessageReplyMarkup({
      botToken: deps.botToken,
      chatId,
      messageId,
      replyMarkup: { inline_keyboard: [] },
    }).catch(() => undefined);
  }

  // After "ready", leave buttons so they can still mark paid or cancel.
  if (messageId != null && parsed.action === "ready") {
    // keep markup
  }

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: followUpMessage(parsed.action, parsed.orderId),
  }).catch(() => undefined);

  void operator;
  void tenant;
  return { handled: true, reason: parsed.action };
}

export function resolveTelegramCallbackSecret() {
  return createTelegramCallbackSecret(process.env);
}
