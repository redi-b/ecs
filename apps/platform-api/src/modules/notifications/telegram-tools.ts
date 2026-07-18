import type { createPlatformDb } from "@ecs/db";
import { tenants } from "@ecs/db";
import { eq } from "drizzle-orm";

import type {
  MerchantOrder,
  MerchantProduct,
  MerchantProductsResult,
  MerchantProductStockUpdateResult,
} from "../../types/index.js";
import type { ManualOrderResult } from "../../adapters/medusa/manual-order-service.js";
import { formatMoneyAmount, formatOrderRef, humanizeToken } from "./renderer.js";
import {
  answerTelegramCallbackQuery,
  sendTelegramBotMessage,
} from "./providers/telegram-provider.js";
import {
  clearDialog,
  getDialog,
  patchDialog,
  setDialog,
  type TelegramDialogState,
} from "./telegram-dialog-state.js";
import type { TelegramOperatorService } from "./telegram-operator.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type TelegramToolsDeps = {
  db: PlatformDb;
  botToken: string;
  operatorService: TelegramOperatorService;
  listMerchantOrders: (input: {
    limit: number;
    offset: number;
    salesChannelId: string;
  }) => Promise<
    | { ok: true; orders: MerchantOrder[]; count: number }
    | { ok: false; error: string; status: number }
  >;
  listMerchantProducts: (input: {
    limit: number;
    offset: number;
    q?: string;
    salesChannelId: string;
    stockLocationId?: string | null;
  }) => Promise<MerchantProductsResult>;
  updateMerchantProductVariantStock: (input: {
    productId: string;
    variantId: string;
    salesChannelId: string;
    stockLocationId: string;
    stockedQuantity: number;
  }) => Promise<MerchantProductStockUpdateResult>;
  createManualOrder: (input: {
    customerEmail: string;
    items: Array<{ quantity: number; variantId: string }>;
    note?: string | null;
    regionId: string;
    salesChannelId: string;
    shippingAddress?: {
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      city?: string | null;
      countryCode?: string | null;
    } | null;
    shippingOptionId?: string | null;
    tenantId: string;
    userId: string;
  }) => Promise<ManualOrderResult>;
};

type OperatorCtx = {
  tenantId: string;
  userId: string;
  salesChannelId: string;
  stockLocationId: string | null;
  regionId: string | null;
  shippingOptionId: string | null;
  tenantName: string;
};

/** Persistent bottom keyboard (always visible when tools are open). */
function mainReplyKeyboard() {
  return {
    keyboard: [
      [{ text: "Today" }, { text: "Stock" }],
      [{ text: "Sale" }, { text: "Menu" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function wizardNavKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "Back to menu", callback_data: "t:menu" },
        { text: "Cancel", callback_data: "t:close" },
      ],
    ],
  };
}

function confirmKeyboard(yesData: string) {
  return {
    inline_keyboard: [
      [
        { text: "Confirm", callback_data: yesData },
        { text: "Cancel", callback_data: "t:close" },
      ],
    ],
  };
}

function qtyKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "0", callback_data: "t:q0" },
        { text: "5", callback_data: "t:q5" },
        { text: "10", callback_data: "t:q10" },
        { text: "20", callback_data: "t:q20" },
      ],
      [{ text: "Back to menu", callback_data: "t:menu" }],
    ],
  };
}

function itemLabel(title?: string, variant?: string) {
  const t = (title ?? "Item").trim();
  const v = (variant ?? "").trim();
  if (!v || v === "Default" || v === t) return t;
  return `${t} · ${v}`;
}

function stepLine(flow: "stock" | "sale", step: number, total: number) {
  const name = flow === "stock" ? "Update stock" : "Offline sale";
  return `<b>${name}</b>  ·  ${step}/${total}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

async function resolveOperatorContext(
  deps: TelegramToolsDeps,
  telegramUserId: string,
): Promise<OperatorCtx | null> {
  const { operators } = await deps.operatorService.resolveOperator({ telegramUserId });
  if (operators.length === 0) return null;
  const op = operators[0]!;
  const [tenant] = await deps.db
    .select({
      medusaSalesChannelId: tenants.medusaSalesChannelId,
      medusaStockLocationId: tenants.medusaStockLocationId,
      medusaRegionId: tenants.medusaRegionId,
      medusaShippingOptionId: tenants.medusaShippingOptionId,
      name: tenants.name,
    })
    .from(tenants)
    .where(eq(tenants.id, op.tenantId))
    .limit(1);

  const salesChannelId = tenant?.medusaSalesChannelId?.trim();
  if (!salesChannelId) return null;

  return {
    tenantId: op.tenantId,
    userId: op.userId,
    salesChannelId,
    stockLocationId: tenant?.medusaStockLocationId?.trim() || null,
    regionId: tenant?.medusaRegionId?.trim() || null,
    shippingOptionId: tenant?.medusaShippingOptionId?.trim() || null,
    tenantName: tenant?.name?.trim() || op.tenantName || "Your shop",
  };
}

function startOfLocalDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isOrderToday(order: MerchantOrder): boolean {
  if (!order.createdAt) return false;
  const created = new Date(order.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return created.getTime() >= startOfLocalDay().getTime();
}

function isPaidStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase().replace(/[_-]+/g, " ");
  return s.includes("captured") || s === "paid" || s.includes("partially refunded");
}

async function sendHome(deps: TelegramToolsDeps, chatId: string, ctx: OperatorCtx) {
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: [
      `<b>${ctx.tenantName}</b>`,
      "What do you need?",
      "",
      "Use the buttons below, or type Menu anytime.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);

  // Inline shortcuts for people who prefer taps in-thread.
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: "Quick actions",
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "Today", callback_data: "t:today" },
          { text: "Stock", callback_data: "t:stock" },
          { text: "Sale", callback_data: "t:sale" },
        ],
      ],
    },
  }).catch(() => undefined);
}

async function sendTodaySummary(deps: TelegramToolsDeps, chatId: string, ctx: OperatorCtx) {
  const list = await deps.listMerchantOrders({
    limit: 50,
    offset: 0,
    salesChannelId: ctx.salesChannelId,
  });
  if (!list.ok) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text: "Couldn’t load orders right now. Try again in a moment.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const today = list.orders.filter(isOrderToday);
  if (today.length === 0) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text: [`<b>Today</b>`, "No orders yet."].join("\n"),
      parseMode: "HTML",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const paid = today.filter((o) => isPaidStatus(o.paymentStatus));
  const unpaid = today.length - paid.length;
  let revenue = 0;
  for (const order of paid) {
    if (typeof order.total === "number" && Number.isFinite(order.total)) {
      revenue += order.total;
    }
  }
  const currency = today[0]?.currencyCode ?? "ETB";
  const revenueLabel = formatMoneyAmount(String(revenue), currency) ?? `${currency} ${revenue}`;

  const lines = [
    `<b>Today</b>`,
    `${today.length} order${today.length === 1 ? "" : "s"} · ${paid.length} paid · ${unpaid} unpaid`,
    `Paid total: ${revenueLabel}`,
    "",
    "<b>Recent</b>",
  ];
  for (const order of today.slice(0, 5)) {
    const pay = order.paymentStatus ? humanizeToken(order.paymentStatus) : "Unknown";
    const total =
      order.total != null
        ? formatMoneyAmount(String(order.total), order.currencyCode ?? undefined) ?? String(order.total)
        : "-";
    lines.push(`${formatOrderRef(order.id)}  ·  ${total}  ·  ${pay}`);
  }

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: lines.join("\n"),
    parseMode: "HTML",
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);
}

function productHits(products: MerchantProduct[]) {
  const hits: NonNullable<TelegramDialogState["hits"]> = [];
  for (const product of products) {
    for (const variant of (product.variants ?? []).slice(0, 3)) {
      if (!variant.id) continue;
      hits.push({
        productId: product.id,
        productTitle: product.title ?? "Product",
        variantId: variant.id,
        variantTitle: variant.title ?? "Default",
        sku: variant.sku ?? null,
      });
      if (hits.length >= 5) return hits;
    }
    if (hits.length >= 5) break;
  }
  return hits;
}

function hitsKeyboard(hits: NonNullable<TelegramDialogState["hits"]>) {
  const rows = hits.map((hit, index) => [
    {
      text: itemLabel(hit.productTitle, hit.variantTitle).slice(0, 56),
      callback_data: `t:i${index}`,
    },
  ]);
  rows.push([{ text: "Back to menu", callback_data: "t:menu" }]);
  return { inline_keyboard: rows };
}

async function beginSearchFlow(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    ctx: OperatorCtx;
    flow: "stock" | "sale";
  },
) {
  setDialog(input.telegramUserId, input.chatId, {
    flow: input.flow,
    step: "await_query",
    tenantId: input.ctx.tenantId,
    userId: input.ctx.userId,
    salesChannelId: input.ctx.salesChannelId,
    stockLocationId: input.ctx.stockLocationId,
    regionId: input.ctx.regionId,
    shippingOptionId: input.ctx.shippingOptionId,
  });

  const total = input.flow === "stock" ? 3 : 5;
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      stepLine(input.flow, 1, total),
      "",
      "Search by product name or SKU.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: wizardNavKeyboard(),
  }).catch(() => undefined);
}

async function runProductSearch(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    dialog: TelegramDialogState;
    query: string;
  },
) {
  const result = await deps.listMerchantProducts({
    limit: 10,
    offset: 0,
    q: input.query,
    salesChannelId: input.dialog.salesChannelId,
    stockLocationId: input.dialog.stockLocationId,
  });

  if (!result.ok) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Search failed. Try a different name.",
      replyMarkup: wizardNavKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const hits = productHits(result.products);
  if (hits.length === 0) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: `No matches for “${input.query.slice(0, 40)}”. Try another search.`,
      replyMarkup: wizardNavKeyboard(),
    }).catch(() => undefined);
    return;
  }

  patchDialog(input.telegramUserId, input.chatId, {
    step: "pick_variant",
    hits,
  });

  const total = input.dialog.flow === "stock" ? 3 : 5;
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [stepLine(input.dialog.flow === "idle" ? "sale" : input.dialog.flow, 2, total), "", "Tap a product:"].join(
      "\n",
    ),
    parseMode: "HTML",
    replyMarkup: hitsKeyboard(hits),
  }).catch(() => undefined);
}

function syntheticEmail(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(-12) || "unknown";
  return `telegram+${digits}@orders.local`;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Customer", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

function parseQty(text: string): number | null {
  const qty = Number(text.replace(/[^\d]/g, ""));
  if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 0) return null;
  return qty;
}

async function applyStock(
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
      text: "Stock location isn’t set up for this shop yet.",
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
      text: "Couldn’t update stock. Try again from the dashboard.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      "<b>Stock updated</b>",
      itemLabel(input.dialog.productTitle, input.dialog.variantTitle),
      `New quantity: ${input.qty}`,
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);
}

async function applySale(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    dialog: TelegramDialogState;
    customerName: string;
  },
) {
  if (!input.dialog.regionId || !input.dialog.variantId || !input.dialog.quantity) {
    clearDialog(input.telegramUserId, input.chatId);
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "This shop isn’t ready for offline sales yet.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const { firstName, lastName } = splitName(input.customerName);
  const phone = input.dialog.customerPhone ?? "";
  const created = await deps.createManualOrder({
    customerEmail: syntheticEmail(phone),
    items: [{ quantity: input.dialog.quantity, variantId: input.dialog.variantId }],
    note: "Created from Telegram offline sale",
    regionId: input.dialog.regionId,
    salesChannelId: input.dialog.salesChannelId,
    shippingAddress: {
      firstName,
      lastName: lastName || null,
      phone,
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
      text: "Couldn’t create the sale. Try again from the dashboard.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const name = `${firstName}${lastName ? ` ${lastName}` : ""}`.trim();
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      `<b>Sale created</b> · ${formatOrderRef(created.order.id)}`,
      itemLabel(input.dialog.productTitle, input.dialog.variantTitle),
      `Qty ${input.dialog.quantity} · ${name} · ${phone}`,
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);
}

/**
 * Handle tool-related callback_query (prefix t:).
 */
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
      text: "Link shop management in Settings first.",
      showAlert: true,
    }).catch(() => undefined);
    return { handled: true, reason: "not_operator" };
  }

  const action = data.slice(2);

  if (action === "close" || action === "menu") {
    clearDialog(telegramUserId, chatId);
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: action === "close" ? "Cancelled" : "Menu",
    }).catch(() => undefined);
    await sendHome(deps, chatId, ctx);
    return { handled: true, reason: action };
  }

  if (action === "today") {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Today",
    }).catch(() => undefined);
    clearDialog(telegramUserId, chatId);
    await sendTodaySummary(deps, chatId, ctx);
    return { handled: true, reason: "today" };
  }

  if (action === "stock" || action === "sale") {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: action === "stock" ? "Stock" : "Sale",
    }).catch(() => undefined);
    await beginSearchFlow(deps, {
      chatId,
      telegramUserId,
      ctx,
      flow: action,
    });
    return { handled: true, reason: action };
  }

  // Quick quantity chips: t:q0 t:q5 …
  const qtyMatch = /^q(\d+)$/.exec(action);
  if (qtyMatch) {
    const dialog = getDialog(telegramUserId, chatId);
    if (!dialog || dialog.step !== "await_qty") {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "That step expired.",
        showAlert: true,
      }).catch(() => undefined);
      return { handled: true, reason: "stale_qty" };
    }
    const qty = Number(qtyMatch[1]);
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: String(qty),
    }).catch(() => undefined);

    if (dialog.flow === "stock") {
      patchDialog(telegramUserId, chatId, { step: "confirm_stock", quantity: qty });
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId,
        text: [
          stepLine("stock", 3, 3),
          "",
          itemLabel(dialog.productTitle, dialog.variantTitle),
          `Set stock to <b>${qty}</b>?`,
        ].join("\n"),
        parseMode: "HTML",
        replyMarkup: confirmKeyboard("t:ok"),
      }).catch(() => undefined);
      return { handled: true, reason: "confirm_stock" };
    }

    if (qty < 1) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId,
        text: "Quantity must be at least 1 for a sale.",
        replyMarkup: qtyKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "sale_qty" };
    }
    patchDialog(telegramUserId, chatId, { step: "await_phone", quantity: qty });
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text: [stepLine("sale", 3, 5), "", "Customer phone?"].join("\n"),
      parseMode: "HTML",
      replyMarkup: wizardNavKeyboard(),
    }).catch(() => undefined);
    return { handled: true, reason: "await_phone" };
  }

  if (action === "ok") {
    const dialog = getDialog(telegramUserId, chatId);
    if (!dialog) {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "Nothing to confirm.",
      }).catch(() => undefined);
      return { handled: true, reason: "no_dialog" };
    }

    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Working…",
    }).catch(() => undefined);

    if (dialog.step === "confirm_stock" && dialog.quantity != null) {
      await applyStock(deps, {
        chatId,
        telegramUserId,
        dialog,
        qty: dialog.quantity,
      });
      return { handled: true, reason: "stock_ok" };
    }

    if (dialog.step === "confirm_sale" && dialog.customerName) {
      await applySale(deps, {
        chatId,
        telegramUserId,
        dialog,
        customerName: dialog.customerName,
      });
      return { handled: true, reason: "sale_ok" };
    }

    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text: "That confirmation expired. Start again from the menu.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    clearDialog(telegramUserId, chatId);
    return { handled: true, reason: "stale_ok" };
  }

  const indexMatch = /^i(\d+)$/.exec(action);
  if (indexMatch) {
    const dialog = getDialog(telegramUserId, chatId);
    const hits = dialog?.hits ?? [];
    const hit = hits[Number(indexMatch[1])];
    if (!dialog || !hit) {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "That choice expired.",
        showAlert: true,
      }).catch(() => undefined);
      return { handled: true, reason: "stale_pick" };
    }

    clearDialog(telegramUserId, chatId);
    setDialog(telegramUserId, chatId, {
      flow: dialog.flow,
      step: "await_qty",
      tenantId: dialog.tenantId,
      userId: dialog.userId,
      salesChannelId: dialog.salesChannelId,
      stockLocationId: dialog.stockLocationId,
      regionId: dialog.regionId,
      shippingOptionId: dialog.shippingOptionId,
      productId: hit.productId,
      variantId: hit.variantId,
      productTitle: hit.productTitle,
      variantTitle: hit.variantTitle,
    });

    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Selected",
    }).catch(() => undefined);

    const total = dialog.flow === "stock" ? 3 : 5;
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text: [
        stepLine(dialog.flow === "idle" ? "sale" : dialog.flow, 2, total),
        "",
        itemLabel(hit.productTitle, hit.variantTitle),
        "",
        dialog.flow === "stock"
          ? "New stock quantity? Tap a number or type one."
          : "How many units? Tap a number or type one.",
      ].join("\n"),
      parseMode: "HTML",
      replyMarkup: qtyKeyboard(),
    }).catch(() => undefined);
    return { handled: true, reason: "picked" };
  }

  await answerTelegramCallbackQuery({
    botToken: deps.botToken,
    callbackQueryId: callbackId,
    text: "Unknown",
  }).catch(() => undefined);
  return { handled: true, reason: "unknown" };
}

/**
 * Handle plain text for tools menu / wizards.
 */
export async function handleTelegramToolsMessage(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    text: string;
  },
): Promise<{ handled: boolean; reason?: string }> {
  const text = input.text.trim();
  const lower = text.toLowerCase();

  const ctx = await resolveOperatorContext(deps, input.telegramUserId);

  const isMenuCommand =
    lower === "/menu" ||
    lower.startsWith("/menu@") ||
    lower === "/start" ||
    /^\/start@\w+$/i.test(lower) ||
    lower === "menu" ||
    lower === "help";

  const isToday = lower === "today";
  const isStock = lower === "stock";
  const isSale = lower === "sale" || lower === "offline sale";

  if (isMenuCommand || isToday || isStock || isSale) {
    if (!ctx) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Link shop management in the dashboard first:\nSettings → Telegram",
      }).catch(() => undefined);
      return { handled: true, reason: "not_operator" };
    }
    clearDialog(input.telegramUserId, input.chatId);
    if (isToday) {
      await sendTodaySummary(deps, input.chatId, ctx);
      return { handled: true, reason: "today" };
    }
    if (isStock || isSale) {
      await beginSearchFlow(deps, {
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        ctx,
        flow: isStock ? "stock" : "sale",
      });
      return { handled: true, reason: isStock ? "stock" : "sale" };
    }
    await sendHome(deps, input.chatId, ctx);
    return { handled: true, reason: "menu" };
  }

  if (!ctx) {
    return { handled: false, reason: "not_operator" };
  }

  const dialog = getDialog(input.telegramUserId, input.chatId);
  if (!dialog) {
    // Linked operator free-typed something: nudge lightly, don’t spam full menu twice.
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Tap a button below, or send Menu.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return { handled: true, reason: "nudge" };
  }

  if (dialog.step === "await_query") {
    if (text.length < 1) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Type a product name or SKU.",
        replyMarkup: wizardNavKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "empty_query" };
    }
    await runProductSearch(deps, {
      chatId: input.chatId,
      telegramUserId: input.telegramUserId,
      dialog,
      query: text,
    });
    return { handled: true, reason: "searched" };
  }

  if (dialog.step === "await_qty") {
    const qty = parseQty(text);
    if (qty == null) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Enter a whole number, or tap one of the buttons.",
        replyMarkup: qtyKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "bad_qty" };
    }

    if (dialog.flow === "stock") {
      patchDialog(input.telegramUserId, input.chatId, {
        step: "confirm_stock",
        quantity: qty,
      });
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: [
          stepLine("stock", 3, 3),
          "",
          itemLabel(dialog.productTitle, dialog.variantTitle),
          `Set stock to <b>${qty}</b>?`,
        ].join("\n"),
        parseMode: "HTML",
        replyMarkup: confirmKeyboard("t:ok"),
      }).catch(() => undefined);
      return { handled: true, reason: "confirm_stock" };
    }

    if (qty < 1) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Sale quantity must be at least 1.",
        replyMarkup: qtyKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "sale_qty" };
    }

    patchDialog(input.telegramUserId, input.chatId, {
      step: "await_phone",
      quantity: qty,
    });
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: [stepLine("sale", 3, 5), "", "Customer phone?"].join("\n"),
      parseMode: "HTML",
      replyMarkup: wizardNavKeyboard(),
    }).catch(() => undefined);
    return { handled: true, reason: "await_phone" };
  }

  if (dialog.step === "await_phone") {
    const phone = text.replace(/[^\d+]/g, "");
    if (phone.length < 8) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "That doesn’t look like a phone number. Try again.",
        replyMarkup: wizardNavKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "bad_phone" };
    }
    patchDialog(input.telegramUserId, input.chatId, {
      step: "await_name",
      customerPhone: phone,
    });
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: [stepLine("sale", 4, 5), "", "Customer name?"].join("\n"),
      parseMode: "HTML",
      replyMarkup: wizardNavKeyboard(),
    }).catch(() => undefined);
    return { handled: true, reason: "await_name" };
  }

  if (dialog.step === "await_name") {
    if (text.length < 2) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Enter the customer’s name.",
        replyMarkup: wizardNavKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "bad_name" };
    }

    patchDialog(input.telegramUserId, input.chatId, {
      step: "confirm_sale",
      customerName: text.trim(),
    });

    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: [
        stepLine("sale", 5, 5),
        "",
        "<b>Confirm sale</b>",
        itemLabel(dialog.productTitle, dialog.variantTitle),
        `Qty ${dialog.quantity}`,
        `${text.trim()} · ${dialog.customerPhone ?? ""}`,
      ].join("\n"),
      parseMode: "HTML",
      replyMarkup: confirmKeyboard("t:ok"),
    }).catch(() => undefined);
    return { handled: true, reason: "confirm_sale" };
  }

  // confirm_stock / confirm_sale only accept buttons
  if (dialog.step === "confirm_stock" || dialog.step === "confirm_sale") {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Tap Confirm or Cancel.",
      replyMarkup: confirmKeyboard("t:ok"),
    }).catch(() => undefined);
    return { handled: true, reason: "await_confirm" };
  }

  clearDialog(input.telegramUserId, input.chatId);
  await sendHome(deps, input.chatId, ctx);
  return { handled: true, reason: "reset" };
}
