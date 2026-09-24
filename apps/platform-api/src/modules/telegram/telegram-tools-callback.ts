import { getOperationalCustomerEmail } from "../commerce/customer-identity.js";
import {
  answerTelegramCallbackQuery,
  sendTelegramBotMessage,
} from "../notifications/providers/telegram-provider.js";
import { buildOrderActionKeyboard } from "./telegram-callback-tokens.js";
import { clearDialog, getDialog, patchDialog } from "./telegram-dialog-state.js";
import { cancelInline, mainReplyKeyboard } from "./telegram-keyboards.js";
import {
  denyNotOperator,
  performUnlink,
  resolveOperatorContext,
  sendHome,
  sendShop,
  sendUnlinkConfirm,
} from "./telegram-operator-tools.js";
import { formatOrderCardHtml } from "./telegram-presentation.js";
import {
  advanceAfterProduct,
  applySale,
  applyStock,
  beginSaleCheckout,
  cartFromDialog,
  goToContactOrConfirmStock,
  promptCustomerEmail,
  saleItemsFromDialog,
  showSaleConfirm,
  startProductPick,
} from "./telegram-sale-flow.js";
import type { TelegramToolsDeps } from "./telegram-tools-contract.js";
import { asRecord, sendOrEdit } from "./telegram-tools-shared.js";

export async function handleTelegramToolsCallback(
  deps: TelegramToolsDeps,
  update: unknown,
): Promise<{ handled: boolean; reason?: string }> {
  const root = asRecord(update);
  const callback = root ? asRecord(root.callback_query) : null;
  if (!callback) return { handled: false, reason: "no_callback" };

  const data = typeof callback.data === "string" ? callback.data : "";
  if (!data.startsWith("t:")) return { handled: false, reason: "not_tools" };

  const callbackId = typeof callback.id === "string" ? callback.id : null;
  const from = asRecord(callback.from);
  const message = asRecord(callback.message);
  const chat = message ? asRecord(message.chat) : null;
  const chatId = chat?.id != null ? String(chat.id) : null;
  const telegramUserId = from?.id != null ? String(from.id) : null;

  if (!callbackId || !chatId || !telegramUserId) {
    return { handled: true, reason: "incomplete" };
  }

  const ctx = await resolveOperatorContext(deps, telegramUserId);
  if (!ctx) {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Link management first",
      showAlert: true,
    }).catch(() => undefined);
    await denyNotOperator(deps, chatId);
    return { handled: true, reason: "not_operator" };
  }

  const action = data.slice(2);

  if (action === "menu" || action === "close") {
    clearDialog(telegramUserId, chatId);
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "OK",
    }).catch(() => undefined);
    await sendHome(deps, chatId, ctx);
    return { handled: true, reason: "menu" };
  }

  if (action === "shop") {
    clearDialog(telegramUserId, chatId);
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Shop",
    }).catch(() => undefined);
    await sendShop(deps, chatId, ctx);
    return { handled: true, reason: "shop" };
  }

  if (action === "unlink") {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Unlink",
    }).catch(() => undefined);
    await sendUnlinkConfirm(deps, chatId, ctx);
    return { handled: true, reason: "unlink_confirm" };
  }

  if (action === "unlink_ok") {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Unlinked",
    }).catch(() => undefined);
    await performUnlink(deps, { chatId, telegramUserId, ctx });
    return { handled: true, reason: "unlinked" };
  }

  if (action === "search") {
    const dialog = getDialog(telegramUserId, chatId);
    if (!dialog || (dialog.flow !== "sale" && dialog.flow !== "stock")) {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Expired",
      }).catch(() => undefined);
      return { handled: true, reason: "stale_search" };
    }
    patchDialog(telegramUserId, chatId, { step: "search", hits: [] });
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Search",
    }).catch(() => undefined);
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text: "🔎 Type a product name or SKU",
      replyMarkup: cancelInline(dialog.flow === "sale" ? "Cancel sale" : "Cancel"),
    }).catch(() => undefined);
    return { handled: true, reason: "search" };
  }

  if (action === "add") {
    const dialog = getDialog(telegramUserId, chatId);
    if (!dialog || dialog.flow !== "sale") {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Expired",
      }).catch(() => undefined);
      return { handled: true, reason: "stale_add" };
    }
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Add product",
    }).catch(() => undefined);
    await startProductPick(deps, {
      chatId,
      telegramUserId,
      ctx,
      flow: "sale",
      cart: cartFromDialog(dialog),
    });
    return { handled: true, reason: "add_product" };
  }

  if (action === "checkout") {
    const dialog = getDialog(telegramUserId, chatId);
    if (
      !dialog ||
      dialog.flow !== "sale" ||
      (dialog.step !== "cart_menu" && dialog.step !== "pick_product" && dialog.step !== "search")
    ) {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Expired",
      }).catch(() => undefined);
      return { handled: true, reason: "stale_checkout" };
    }
    if (cartFromDialog(dialog).length === 0) {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Add a product first",
        showAlert: true,
      }).catch(() => undefined);
      return { handled: true, reason: "empty_cart" };
    }
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Continue",
    }).catch(() => undefined);
    await beginSaleCheckout(deps, { chatId, telegramUserId, ctx, dialog });
    return { handled: true, reason: "checkout" };
  }

  if (action === "skip_name") {
    const dialog = getDialog(telegramUserId, chatId);
    if (
      !dialog ||
      dialog.flow !== "sale" ||
      dialog.step !== "await_name" ||
      !dialog.customerPhone
    ) {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Expired",
      }).catch(() => undefined);
      return { handled: true, reason: "stale_skip_name" };
    }
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Skipped",
    }).catch(() => undefined);
    await promptCustomerEmail(deps, {
      chatId,
      telegramUserId,
      dialog,
      phone: dialog.customerPhone,
      name: "Customer",
    });
    return { handled: true, reason: "await_email" };
  }

  if (action === "walkin") {
    const dialog = getDialog(telegramUserId, chatId);
    if (!dialog || dialog.flow !== "sale" || dialog.step !== "await_email") {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Expired",
      }).catch(() => undefined);
      return { handled: true, reason: "stale_walkin" };
    }
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Walk-in",
    }).catch(() => undefined);
    await showSaleConfirm(deps, {
      chatId,
      telegramUserId,
      dialog,
      email:
        getOperationalCustomerEmail({
          phone: dialog.customerPhone,
          tenantId: dialog.tenantId,
        }) ?? "",
    });
    return { handled: true, reason: "walkin" };
  }

  const qtyMatch = /^q(\d+)$/.exec(action);
  if (qtyMatch) {
    const dialog = getDialog(telegramUserId, chatId);
    if (!dialog || dialog.step !== "await_qty") {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Expired",
      }).catch(() => undefined);
      return { handled: true, reason: "stale_qty" };
    }
    const qty = Number(qtyMatch[1]);
    if (dialog.flow === "sale" && qty < 1) {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Need at least 1",
        showAlert: true,
      }).catch(() => undefined);
      return { handled: true, reason: "sale_qty" };
    }
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: String(qty),
    }).catch(() => undefined);
    await goToContactOrConfirmStock(deps, {
      chatId,
      telegramUserId,
      ctx,
      dialog,
      qty,
    });
    return { handled: true, reason: "qty" };
  }

  if (action === "ok") {
    const dialog = getDialog(telegramUserId, chatId);
    if (!dialog) {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Nothing to confirm",
      }).catch(() => undefined);
      return { handled: true, reason: "no_dialog" };
    }
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "OK",
    }).catch(() => undefined);

    if (dialog.step === "confirm_stock" && dialog.quantity != null) {
      await applyStock(deps, { chatId, telegramUserId, dialog, qty: dialog.quantity });
      return { handled: true, reason: "stock_ok" };
    }
    if (
      dialog.step === "confirm_sale" &&
      dialog.customerPhone &&
      dialog.customerName &&
      saleItemsFromDialog(dialog).length > 0
    ) {
      await applySale(deps, {
        chatId,
        telegramUserId,
        dialog,
        customerName: dialog.customerName,
        customerPhone: dialog.customerPhone,
      });
      return { handled: true, reason: "sale_ok" };
    }
    clearDialog(telegramUserId, chatId);
    await sendHome(deps, chatId, ctx);
    return { handled: true, reason: "stale_ok" };
  }

  const indexMatch = /^i(\d+)$/.exec(action);
  if (indexMatch) {
    const dialog = getDialog(telegramUserId, chatId);
    const hit = dialog?.hits?.[Number(indexMatch[1])];
    if (!dialog || !hit || (dialog.step !== "pick_product" && dialog.step !== "search")) {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Expired",
        showAlert: true,
      }).catch(() => undefined);
      return { handled: true, reason: "stale_pick" };
    }
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Selected",
    }).catch(() => undefined);
    await advanceAfterProduct(deps, {
      chatId,
      telegramUserId,
      ctx,
      flow: dialog.flow === "stock" ? "stock" : "sale",
      hit,
    });
    return { handled: true, reason: "picked" };
  }

  const orderMatch = /^o(\d+)$/.exec(action);
  if (orderMatch) {
    const dialog = getDialog(telegramUserId, chatId);
    const orderId = dialog?.orderIds?.[Number(orderMatch[1])];
    if (!dialog || dialog.step !== "orders_list" || !orderId) {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Expired",
      }).catch(() => undefined);
      return { handled: true, reason: "stale_order" };
    }
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Loading…",
    }).catch(() => undefined);

    const loading = await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text: "Loading order…",
      replyMarkup: cancelInline(),
    }).catch(() => null);

    const list = await deps.listMerchantOrders({
      limit: 20,
      offset: 0,
      salesChannelId: ctx.salesChannelId,
    });
    const order = list.ok ? list.orders.find((o) => o.id === orderId) : null;
    if (!order) {
      await sendOrEdit(deps, {
        chatId,
        messageId: loading?.messageId ?? null,
        text: "Order not found.",
        replyMarkup: mainReplyKeyboard(),
      });
      return { handled: true, reason: "order_missing" };
    }

    // Full card here — no need for a separate Details press from this surface.
    const markup =
      deps.callbackSecret != null
        ? buildOrderActionKeyboard({
            orderId: order.id,
            tenantId: ctx.tenantId,
            secret: deps.callbackSecret,
            exclude: ["details"],
          })
        : null;

    await sendOrEdit(deps, {
      chatId,
      messageId: loading?.messageId ?? null,
      text: formatOrderCardHtml(order),
      parseMode: "HTML",
      replyMarkup: markup ?? mainReplyKeyboard(),
    });
    return { handled: true, reason: "order_detail" };
  }

  await answerTelegramCallbackQuery({
    botToken: deps.botToken,
    callbackQueryId: callbackId,
    text: "…",
  }).catch(() => undefined);
  return { handled: true, reason: "unknown" };
}

/**
 * Text + optional contact share for guided POS tools.
 */
