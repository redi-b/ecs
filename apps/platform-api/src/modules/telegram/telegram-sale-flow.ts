import type { MerchantProduct } from "../../types/index.js";
import {
  isSyntheticCustomerEmail,
  normalizeOperationalPhone,
} from "../commerce/customer-identity.js";
import { sendTelegramBotMessage } from "../notifications/providers/telegram-provider.js";
import { formatOrderRef } from "../notifications/renderer.js";
import {
  clearDialog,
  getDialog,
  patchDialog,
  setDialog,
  type TelegramCartLine,
  type TelegramDialogState,
  type TelegramProductHit,
} from "./telegram-dialog-state.js";
import {
  cancelInline,
  cartMenuInline,
  confirmInline,
  emailPromptMarkup,
  formatCartSummary,
  itemLabel,
  mainReplyKeyboard,
  namePromptMarkup,
  phonePromptMarkup,
  productPickInline,
  qtyInline,
} from "./telegram-keyboards.js";
import { sendHome } from "./telegram-operator-tools.js";
import { adminUrl, formatItemLine, htmlLink } from "./telegram-presentation.js";
import { buildRecentProductHits, productHitsFromCatalog } from "./telegram-recent-products.js";
import type { TelegramOperatorContext, TelegramToolsDeps } from "./telegram-tools-contract.js";
import { dialogBase, sendOrEdit } from "./telegram-tools-shared.js";

export function isValidCustomerEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  if (email.length < 5 || email.length > 120) return false;
  // Simple merchant-friendly check (not full RFC).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isWalkInEmail(email: string): boolean {
  return isSyntheticCustomerEmail(email);
}

/**
 * Medusa needs an email on the order/customer record.
 * - Real email: find-or-create that customer; store name + phone on the profile.
 * - No email: one stable offline customer per shop and phone, so repeat sales
 *   remain discoverable without exposing the internal placeholder address.
 */
async function ensureSaleCustomer(
  deps: TelegramToolsDeps,
  input: {
    tenantId: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
  },
): Promise<{ email: string; customerId?: string }> {
  const email = input.email.trim().toLowerCase();
  const phone = normalizeOperationalPhone(input.phone);
  if (!deps.ensureMerchantCustomer) {
    return { email };
  }

  const ensured = await deps.ensureMerchantCustomer({
    tenantId: input.tenantId,
    email,
    phone: phone ? `+${phone}` : input.phone,
    firstName: input.firstName && !/^customer$/i.test(input.firstName) ? input.firstName : null,
    lastName: input.lastName || null,
  });
  if (ensured.ok) {
    return { email: ensured.customer.email || email, customerId: ensured.customer.id };
  }
  return { email };
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "Customer";
  if (parts.length <= 1) return { firstName, lastName: "" };
  return { firstName, lastName: parts.slice(1).join(" ") };
}

export function parseQty(text: string, min: number): number | null {
  const cleaned = text.trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const qty = Number(cleaned);
  if (!Number.isInteger(qty) || qty < min) return null;
  return qty;
}

export async function searchProducts(
  deps: TelegramToolsDeps,
  ctx: TelegramOperatorContext,
  query: string,
): Promise<TelegramProductHit[] | null> {
  const q = query.trim();
  if (!q) return [];
  const result = await deps.listMerchantProducts({
    limit: 12,
    offset: 0,
    q,
    salesChannelId: ctx.salesChannelId,
    stockLocationId: ctx.stockLocationId,
  });
  if (!result.ok) return null;
  return productHitsFromCatalog(result.products, 6);
}

async function loadPickHits(
  deps: TelegramToolsDeps,
  ctx: TelegramOperatorContext,
): Promise<TelegramProductHit[]> {
  const [ordersRes, productsRes] = await Promise.all([
    deps.listMerchantOrders({
      limit: 30,
      offset: 0,
      salesChannelId: ctx.salesChannelId,
    }),
    deps.listMerchantProducts({
      limit: 12,
      offset: 0,
      salesChannelId: ctx.salesChannelId,
      stockLocationId: ctx.stockLocationId,
    }),
  ]);

  const orders = ordersRes.ok ? ordersRes.orders : [];
  const catalog: MerchantProduct[] = productsRes.ok ? productsRes.products : [];
  return buildRecentProductHits({ orders, catalogProducts: catalog, limit: 6 });
}

export function cartFromDialog(dialog: TelegramDialogState): TelegramCartLine[] {
  return Array.isArray(dialog.cart) ? [...dialog.cart] : [];
}

function mergeCartLine(cart: TelegramCartLine[], line: TelegramCartLine): TelegramCartLine[] {
  const next = [...cart];
  const index = next.findIndex((row) => row.variantId === line.variantId);
  if (index >= 0) {
    const existing = next[index];
    if (existing) {
      next[index] = { ...existing, quantity: existing.quantity + line.quantity };
      return next;
    }
  }
  next.push(line);
  return next;
}

export function saleItemsFromDialog(
  dialog: TelegramDialogState,
): Array<{ quantity: number; variantId: string }> {
  const cart = cartFromDialog(dialog);
  if (cart.length > 0) {
    return cart.map((line) => ({ quantity: line.quantity, variantId: line.variantId }));
  }
  if (dialog.variantId && dialog.quantity && dialog.quantity >= 1) {
    return [{ quantity: dialog.quantity, variantId: dialog.variantId }];
  }
  return [];
}

export async function startProductPick(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    ctx: TelegramOperatorContext;
    flow: "sale" | "stock";
    /** Preserve cart when adding another product to a sale. */
    cart?: TelegramCartLine[];
  },
) {
  const cart = input.cart ?? [];
  const title =
    input.flow === "sale"
      ? cart.length > 0
        ? `🛒 <b>Add product</b>\n${formatCartSummary(cart)}`
        : "🛒 <b>New sale</b>\nPick a product"
      : "📦 <b>Stock</b>\nPick a product";
  const loading = await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: "Loading products…",
    replyMarkup: cancelInline(input.flow === "sale" && cart.length > 0 ? "Cancel sale" : "Cancel"),
  }).catch(() => null);

  const hits = await loadPickHits(deps, input.ctx);
  setDialog(input.telegramUserId, input.chatId, {
    ...dialogBase(input.ctx, input.flow, "pick_product"),
    hits,
    ...(input.flow === "sale" && cart.length ? { cart } : {}),
  });

  if (hits.length === 0) {
    const emptyHint = adminUrl(input.ctx.adminBase, "/products");
    await sendOrEdit(deps, {
      chatId: input.chatId,
      messageId: loading?.messageId ?? null,
      text: [
        title,
        "",
        "No products yet. Tap Search, or add products in the dashboard.",
        emptyHint ? htmlLink(emptyHint, "Open products") : null,
      ]
        .filter(Boolean)
        .join("\n"),
      parseMode: "HTML",
      replyMarkup: productPickInline([], { cartCount: cart.length }),
    });
    return;
  }

  await sendOrEdit(deps, {
    chatId: input.chatId,
    messageId: loading?.messageId ?? null,
    text: title,
    parseMode: "HTML",
    replyMarkup: productPickInline(hits, { cartCount: cart.length }),
  });
}

export async function advanceAfterProduct(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    ctx: TelegramOperatorContext;
    flow: "sale" | "stock";
    hit: TelegramProductHit;
  },
) {
  const previous = getDialog(input.telegramUserId, input.chatId);
  const existingCart = input.flow === "sale" && previous ? cartFromDialog(previous) : [];
  setDialog(input.telegramUserId, input.chatId, {
    ...dialogBase(input.ctx, input.flow, "await_qty"),
    productId: input.hit.productId,
    variantId: input.hit.variantId,
    productTitle: input.hit.productTitle,
    variantTitle: input.hit.variantTitle,
    ...(existingCart.length ? { cart: existingCart } : {}),
  });

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      `📦 <b>${itemLabel(input.hit.productTitle, input.hit.variantTitle)}</b>`,
      input.flow === "sale"
        ? "How many? Tap a number or type one."
        : "New stock quantity? Tap a number or type one.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: qtyInline(input.flow),
  }).catch(() => undefined);
}

export async function goToContactOrConfirmStock(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    ctx: TelegramOperatorContext;
    dialog: TelegramDialogState;
    qty: number;
  },
) {
  if (input.dialog.flow === "stock") {
    const next: Omit<TelegramDialogState, "expiresAt"> = {
      ...dialogBase(input.ctx, "stock", "confirm_stock"),
      quantity: input.qty,
    };
    if (input.dialog.productId) next.productId = input.dialog.productId;
    if (input.dialog.variantId) next.variantId = input.dialog.variantId;
    if (input.dialog.productTitle) next.productTitle = input.dialog.productTitle;
    if (input.dialog.variantTitle) next.variantTitle = input.dialog.variantTitle;
    setDialog(input.telegramUserId, input.chatId, next);
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: `Set <b>${itemLabel(input.dialog.productTitle, input.dialog.variantTitle)}</b> → <b>${input.qty}</b>?`,
      parseMode: "HTML",
      replyMarkup: confirmInline(),
    }).catch(() => undefined);
    return;
  }

  // sale: append to cart, then let operator add more or continue
  if (!input.dialog.variantId || !input.dialog.productId) {
    clearDialog(input.telegramUserId, input.chatId);
    await sendHome(deps, input.chatId, input.ctx);
    return;
  }

  const line: TelegramCartLine = {
    productId: input.dialog.productId,
    productTitle: input.dialog.productTitle ?? "Product",
    variantId: input.dialog.variantId,
    variantTitle: input.dialog.variantTitle ?? "",
    quantity: input.qty,
  };
  const cart = mergeCartLine(cartFromDialog(input.dialog), line);
  setDialog(input.telegramUserId, input.chatId, {
    ...dialogBase(input.ctx, "sale", "cart_menu"),
    cart,
  });
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      "🛒 <b>Cart</b>",
      formatCartSummary(cart),
      "",
      "Add another product, or continue to the customer.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: cartMenuInline(cart.length),
  }).catch(() => undefined);
}

export async function beginSaleCheckout(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    ctx: TelegramOperatorContext;
    dialog: TelegramDialogState;
  },
) {
  const cart = cartFromDialog(input.dialog);
  if (cart.length === 0) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Add at least one product first.",
      replyMarkup: cartMenuInline(0),
    }).catch(() => undefined);
    return;
  }

  setDialog(input.telegramUserId, input.chatId, {
    ...dialogBase(input.ctx, "sale", "await_contact"),
    cart,
  });
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      "🛒 <b>Cart</b>",
      formatCartSummary(cart),
      "",
      "📱 Type the <b>customer’s</b> phone number.",
      "Or use 📎 → Contact to pick them from your phone.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: phonePromptMarkup(),
  }).catch(() => undefined);
}

export async function applyStock(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    dialog: TelegramDialogState;
    qty: number;
  },
) {
  if (!input.dialog.stockLocationId || !input.dialog.productId || !input.dialog.variantId) {
    clearDialog(input.telegramUserId, input.chatId);
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Stock location is not set up.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const updated = await deps.updateMerchantProductVariantStock({
    productId: input.dialog.productId,
    variantId: input.dialog.variantId,
    salesChannelId: input.dialog.salesChannelId,
    stockLocationId: input.dialog.stockLocationId,
    stockedQuantity: input.qty,
  });

  clearDialog(input.telegramUserId, input.chatId);
  if (!updated.ok) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Could not update stock.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: `📦 Stock updated · ${itemLabel(input.dialog.productTitle, input.dialog.variantTitle)} → <b>${input.qty}</b>`,
    parseMode: "HTML",
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);
}

export async function applySale(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    dialog: TelegramDialogState;
    customerName: string;
    customerPhone: string;
  },
) {
  const items = saleItemsFromDialog(input.dialog);
  if (!input.dialog.regionId || items.length === 0) {
    clearDialog(input.telegramUserId, input.chatId);
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Shop is not ready for offline sales.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const email = (input.dialog.customerEmail ?? "").trim().toLowerCase();
  if (!email || !input.dialog.customerPhone) {
    clearDialog(input.telegramUserId, input.chatId);
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Sale expired. Start New sale again.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const { firstName, lastName } = splitName(input.customerName);
  const resolved = await ensureSaleCustomer(deps, {
    tenantId: input.dialog.tenantId,
    email,
    phone: input.customerPhone,
    firstName,
    lastName,
  });

  const created = await deps.createManualOrder({
    customerEmail: resolved.email,
    ...(resolved.customerId ? { customerId: resolved.customerId } : {}),
    items,
    note: "Telegram offline sale",
    regionId: input.dialog.regionId,
    salesChannelId: input.dialog.salesChannelId,
    shippingAddress: {
      firstName,
      lastName: lastName || null,
      phone: input.customerPhone,
      city: "Addis Ababa",
      countryCode: "et",
    },
    shippingOptionId: input.dialog.shippingOptionId,
    tenantId: input.dialog.tenantId,
    userId: input.dialog.userId,
  });

  clearDialog(input.telegramUserId, input.chatId);

  if (!created.ok) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Could not create the sale.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const whoLine =
    fullName && !/^customer$/i.test(fullName)
      ? `${fullName} · ${input.customerPhone}`
      : input.customerPhone;
  const emailLine = isWalkInEmail(resolved.email) ? "Walk-in" : resolved.email;
  const cart = cartFromDialog(input.dialog);
  const itemsBlock =
    cart.length > 0
      ? formatCartSummary(cart)
      : formatItemLine(input.dialog.productTitle, input.dialog.variantTitle, input.dialog.quantity);
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      `✅ <b>Sale ${formatOrderRef(created.order.id)}</b>`,
      itemsBlock,
      whoLine,
      emailLine,
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);
}

export async function promptCustomerName(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    dialog: TelegramDialogState;
    phone: string;
    /** Pre-filled when contact share included a name */
    name?: string | null;
  },
) {
  const phone = input.phone.replace(/[^\d+]/g, "");
  if (phone.length < 8 || saleItemsFromDialog(input.dialog).length === 0) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Need a valid customer phone and at least one product.",
      replyMarkup: phonePromptMarkup(),
    }).catch(() => undefined);
    return;
  }

  const prefilled = (input.name ?? "").trim();
  if (prefilled && !/^customer$/i.test(prefilled)) {
    // Contact share already gave a name — skip the name step.
    await promptCustomerEmail(deps, {
      chatId: input.chatId,
      telegramUserId: input.telegramUserId,
      dialog: input.dialog,
      phone,
      name: prefilled,
    });
    return;
  }

  patchDialog(input.telegramUserId, input.chatId, {
    step: "await_name",
    customerPhone: phone,
    customerName: "Customer",
  });

  const cart = cartFromDialog(input.dialog);
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      "🛒 <b>Cart</b>",
      cart.length
        ? formatCartSummary(cart)
        : formatItemLine(
            input.dialog.productTitle,
            input.dialog.variantTitle,
            input.dialog.quantity,
          ),
      phone,
      "",
      "Customer name? Type it, or Skip.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: namePromptMarkup(),
  }).catch(() => undefined);
}

export async function promptCustomerEmail(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    dialog: TelegramDialogState;
    phone: string;
    name: string;
  },
) {
  const phone = input.phone.replace(/[^\d+]/g, "");
  patchDialog(input.telegramUserId, input.chatId, {
    step: "await_email",
    customerPhone: phone,
    customerName: input.name?.trim() || "Customer",
  });

  const displayName = (input.name || "").trim();
  const who = displayName && !/^customer$/i.test(displayName) ? `${displayName} · ${phone}` : phone;

  const cart = cartFromDialog(input.dialog);
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      "🛒 <b>Cart</b>",
      cart.length
        ? formatCartSummary(cart)
        : formatItemLine(
            input.dialog.productTitle,
            input.dialog.variantTitle,
            input.dialog.quantity,
          ),
      who,
      "",
      "Customer email? Type it, or Walk-in if they have no email.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: emailPromptMarkup(),
  }).catch(() => undefined);
}

export async function showSaleConfirm(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    dialog: TelegramDialogState;
    email: string;
  },
) {
  const phone = (input.dialog.customerPhone ?? "").replace(/[^\d+]/g, "");
  const email = input.email.trim().toLowerCase();
  const items = saleItemsFromDialog(input.dialog);
  if (phone.length < 8 || items.length === 0 || !email) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Sale details incomplete. Start New sale again.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  patchDialog(input.telegramUserId, input.chatId, {
    step: "confirm_sale",
    customerEmail: email,
  });

  const displayName = (input.dialog.customerName || "").trim();
  const who = displayName && !/^customer$/i.test(displayName) ? `${displayName} · ${phone}` : phone;
  const emailLine = isWalkInEmail(email) ? "Walk-in" : email;
  const cart = cartFromDialog(input.dialog);

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      "✅ <b>Confirm sale</b>",
      cart.length
        ? formatCartSummary(cart)
        : formatItemLine(
            input.dialog.productTitle,
            input.dialog.variantTitle,
            input.dialog.quantity,
          ),
      who,
      emailLine,
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: confirmInline(),
  }).catch(() => undefined);
}
