import { sendTelegramBotMessage } from "../notifications/providers/telegram-provider.js";
import { clearDialog, getDialog, patchDialog } from "./telegram-dialog-state.js";
import {
  cancelInline,
  cartMenuInline,
  confirmInline,
  emailPromptMarkup,
  formatCartSummary,
  MAIN_KEYBOARD_LABELS,
  mainReplyKeyboard,
  matchesMainLabel,
  namePromptMarkup,
  phonePromptMarkup,
  productPickInline,
  qtyInline,
  searchResultsInline,
} from "./telegram-keyboards.js";
import {
  denyNotOperator,
  resolveOperatorContext,
  sendHelp,
  sendHome,
  sendOrdersList,
  sendShop,
  sendTodaySummary,
} from "./telegram-operator-tools.js";
import {
  advanceAfterProduct,
  cartFromDialog,
  goToContactOrConfirmStock,
  isValidCustomerEmail,
  parseQty,
  promptCustomerEmail,
  promptCustomerName,
  saleItemsFromDialog,
  searchProducts,
  showSaleConfirm,
  startProductPick,
} from "./telegram-sale-flow.js";
import type { TelegramToolsDeps } from "./telegram-tools-contract.js";
import { asRecord } from "./telegram-tools-shared.js";

export async function handleTelegramToolsMessage(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    text: string;
    contact?: { phone?: string | null; firstName?: string | null; lastName?: string | null } | null;
  },
): Promise<{ handled: boolean; reason?: string }> {
  const text = input.text.trim();
  const lower = text.toLowerCase();
  const ctx = await resolveOperatorContext(deps, input.telegramUserId);

  /**
   * /start with a payload is deep-link connect (notifications or operator).
   * Must not be claimed here or linking never runs.
   * Bare /start: home if linked, otherwise fall through to connect help.
   */
  const startMatch = text.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(.+))?$/i);
  if (startMatch) {
    const payload = (startMatch[1] ?? "").trim();
    if (payload) {
      return { handled: false, reason: "start_deep_link" };
    }
    if (ctx) {
      clearDialog(input.telegramUserId, input.chatId);
      await sendHome(deps, input.chatId, ctx);
      return { handled: true, reason: "home" };
    }
    return { handled: false, reason: "start_unlinked" };
  }

  // Contact share mid-sale
  if (input.contact?.phone) {
    if (!ctx) {
      await denyNotOperator(deps, input.chatId);
      return { handled: true, reason: "not_operator" };
    }
    const dialog = getDialog(input.telegramUserId, input.chatId);
    if (
      !dialog ||
      dialog.flow !== "sale" ||
      dialog.step !== "await_contact" ||
      saleItemsFromDialog(dialog).length === 0
    ) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Start with New sale first.",
        replyMarkup: mainReplyKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "contact_no_sale" };
    }
    const name =
      [input.contact.firstName, input.contact.lastName].filter(Boolean).join(" ").trim() || null;
    await promptCustomerName(deps, {
      chatId: input.chatId,
      telegramUserId: input.telegramUserId,
      dialog,
      phone: input.contact.phone,
      name,
    });
    return { handled: true, reason: "await_name" };
  }

  const isMenu =
    lower === "/menu" ||
    lower.startsWith("/menu@") ||
    lower === "menu" ||
    matchesMainLabel(text, MAIN_KEYBOARD_LABELS.cancel) ||
    lower === "cancel" ||
    lower === "/cancel" ||
    lower.startsWith("/cancel@");
  const isToday =
    matchesMainLabel(text, MAIN_KEYBOARD_LABELS.today) ||
    lower === "/today" ||
    lower.startsWith("/today@");
  const isStock =
    matchesMainLabel(text, MAIN_KEYBOARD_LABELS.stock) ||
    lower === "/stock" ||
    lower.startsWith("/stock@");
  const isSale =
    matchesMainLabel(text, MAIN_KEYBOARD_LABELS.newSale) ||
    lower === "/sale" ||
    lower.startsWith("/sale@");
  const isOrders =
    matchesMainLabel(text, MAIN_KEYBOARD_LABELS.orders) ||
    lower === "/orders" ||
    lower.startsWith("/orders@");
  const isShop =
    matchesMainLabel(text, MAIN_KEYBOARD_LABELS.shop) ||
    lower === "/shop" ||
    lower.startsWith("/shop@");
  const isHelp =
    matchesMainLabel(text, MAIN_KEYBOARD_LABELS.help) ||
    lower === "/help" ||
    lower.startsWith("/help@");

  if (isMenu || isToday || isStock || isSale || isOrders || isShop || isHelp) {
    if (!ctx) {
      await denyNotOperator(deps, input.chatId);
      return { handled: true, reason: "not_operator" };
    }
    clearDialog(input.telegramUserId, input.chatId);
    if (isToday) {
      await sendTodaySummary(deps, input.chatId, ctx);
      return { handled: true, reason: "today" };
    }
    if (isStock) {
      await startProductPick(deps, {
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        ctx,
        flow: "stock",
      });
      return { handled: true, reason: "stock" };
    }
    if (isSale) {
      await startProductPick(deps, {
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        ctx,
        flow: "sale",
      });
      return { handled: true, reason: "sale" };
    }
    if (isOrders) {
      await sendOrdersList(deps, {
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        ctx,
      });
      return { handled: true, reason: "orders" };
    }
    if (isShop) {
      await sendShop(deps, input.chatId, ctx);
      return { handled: true, reason: "shop" };
    }
    if (isHelp) {
      await sendHelp(deps, input.chatId, ctx);
      return { handled: true, reason: "help" };
    }
    await sendHome(deps, input.chatId, ctx);
    return { handled: true, reason: "menu" };
  }

  if (!ctx) {
    // Unknown slash from unlinked chat (not /start — handled above).
    // Tools-specific commands: point to dashboard. Everything else falls through.
    if (
      lower === "/sale" ||
      lower.startsWith("/sale@") ||
      lower === "/stock" ||
      lower.startsWith("/stock@") ||
      lower === "/today" ||
      lower.startsWith("/today@") ||
      lower === "/orders" ||
      lower.startsWith("/orders@") ||
      lower === "/shop" ||
      lower.startsWith("/shop@") ||
      lower === "/menu" ||
      lower.startsWith("/menu@") ||
      lower === "/help" ||
      lower.startsWith("/help@") ||
      lower === "/cancel" ||
      lower.startsWith("/cancel@")
    ) {
      await denyNotOperator(deps, input.chatId);
      return { handled: true, reason: "not_operator" };
    }
    return { handled: false, reason: "not_operator" };
  }

  const dialog = getDialog(input.telegramUserId, input.chatId);

  if (dialog?.step === "search") {
    const hits = await searchProducts(deps, ctx, text);
    if (hits == null) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Search failed. Try again.",
        replyMarkup: cancelInline(),
      }).catch(() => undefined);
      return { handled: true, reason: "search_fail" };
    }
    if (hits.length === 0) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "No match. Try another name or SKU.",
        replyMarkup: cancelInline(),
      }).catch(() => undefined);
      return { handled: true, reason: "no_hits" };
    }
    const [onlyHit] = hits;
    if (onlyHit) {
      await advanceAfterProduct(deps, {
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        ctx,
        flow: dialog.flow === "stock" ? "stock" : "sale",
        hit: onlyHit,
      });
      return { handled: true, reason: "search_one" };
    }
    patchDialog(input.telegramUserId, input.chatId, {
      step: "search",
      hits,
    });
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Pick one:",
      replyMarkup: searchResultsInline(hits),
    }).catch(() => undefined);
    return { handled: true, reason: "search_many" };
  }

  if (dialog?.step === "await_qty") {
    const min = dialog.flow === "sale" ? 1 : 0;
    const qty = parseQty(text, min);
    if (qty == null) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: dialog.flow === "sale" ? "Enter a number ≥ 1." : "Enter a whole number.",
        replyMarkup: qtyInline(dialog.flow === "stock" ? "stock" : "sale"),
      }).catch(() => undefined);
      return { handled: true, reason: "bad_qty" };
    }
    await goToContactOrConfirmStock(deps, {
      chatId: input.chatId,
      telegramUserId: input.telegramUserId,
      ctx,
      dialog,
      qty,
    });
    return { handled: true, reason: "qty_typed" };
  }

  if (dialog?.step === "cart_menu" && dialog.flow === "sale") {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: [
        "🛒 <b>Cart</b>",
        formatCartSummary(cartFromDialog(dialog)),
        "",
        "Use the buttons to add a product or continue.",
      ].join("\n"),
      parseMode: "HTML",
      replyMarkup: cartMenuInline(cartFromDialog(dialog).length),
    }).catch(() => undefined);
    return { handled: true, reason: "cart_menu_prompt" };
  }

  if (dialog?.step === "await_contact" && dialog.flow === "sale") {
    const phone = text.replace(/[^\d+]/g, "");
    if (phone.length < 8) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Type the customer’s phone number (at least 8 digits).",
        replyMarkup: phonePromptMarkup(),
      }).catch(() => undefined);
      return { handled: true, reason: "bad_phone" };
    }
    await promptCustomerName(deps, {
      chatId: input.chatId,
      telegramUserId: input.telegramUserId,
      dialog,
      phone,
      name: null,
    });
    return { handled: true, reason: "await_name" };
  }

  if (dialog?.step === "await_name" && dialog.flow === "sale") {
    const name = text.trim();
    if (name.length < 1 || name.length > 80) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Type a name, or tap Skip.",
        replyMarkup: namePromptMarkup(),
      }).catch(() => undefined);
      return { handled: true, reason: "bad_name" };
    }
    await promptCustomerEmail(deps, {
      chatId: input.chatId,
      telegramUserId: input.telegramUserId,
      dialog,
      phone: dialog.customerPhone ?? "",
      name,
    });
    return { handled: true, reason: "await_email" };
  }

  if (dialog?.step === "await_email" && dialog.flow === "sale") {
    if (!isValidCustomerEmail(text)) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Type a valid email, or tap Walk-in.",
        replyMarkup: emailPromptMarkup(),
      }).catch(() => undefined);
      return { handled: true, reason: "bad_email" };
    }
    await showSaleConfirm(deps, {
      chatId: input.chatId,
      telegramUserId: input.telegramUserId,
      dialog,
      email: text.trim().toLowerCase(),
    });
    return { handled: true, reason: "confirm_sale" };
  }

  if (dialog?.step === "confirm_sale" || dialog?.step === "confirm_stock") {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Tap Confirm or Cancel.",
      replyMarkup: confirmInline(),
    }).catch(() => undefined);
    return { handled: true, reason: "await_confirm" };
  }

  if (dialog?.step === "pick_product") {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Tap a product, Search, or Cancel.",
      replyMarkup: dialog.hits ? productPickInline(dialog.hits) : cancelInline(),
    }).catch(() => undefined);
    return { handled: true, reason: "await_pick" };
  }

  // Linked free text: short home
  await sendHome(deps, input.chatId, ctx);
  return { handled: true, reason: "home" };
}

export function extractTelegramContact(message: unknown): {
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null {
  const msg = asRecord(message);
  const contact = msg ? asRecord(msg.contact) : null;
  if (!contact) return null;
  return {
    phone: typeof contact.phone_number === "string" ? contact.phone_number : null,
    firstName: typeof contact.first_name === "string" ? contact.first_name : null,
    lastName: typeof contact.last_name === "string" ? contact.last_name : null,
  };
}
