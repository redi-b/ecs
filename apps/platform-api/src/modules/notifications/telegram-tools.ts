import type { createPlatformDb } from "@ecs/db";
import { tenants } from "@ecs/db";
import { eq } from "drizzle-orm";

import type {
  MerchantOrder,
  MerchantOrderActionResult,
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function menuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "Today", callback_data: "t:today" },
        { text: "Stock", callback_data: "t:stock" },
      ],
      [
        { text: "Offline sale", callback_data: "t:sale" },
        { text: "Close", callback_data: "t:close" },
      ],
    ],
  };
}

function cancelKeyboard() {
  return {
    inline_keyboard: [[{ text: "Cancel", callback_data: "t:close" }]],
  };
}

async function resolveOperatorContext(
  deps: TelegramToolsDeps,
  telegramUserId: string,
): Promise<OperatorCtx | null> {
  const { operators } = await deps.operatorService.resolveOperator({ telegramUserId });
  if (operators.length === 0) return null;
  // v1: first linked shop (multi-shop picker later).
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
    tenantName: tenant?.name?.trim() || op.tenantName || "your shop",
  };
}

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isOrderToday(order: MerchantOrder): boolean {
  if (!order.createdAt) return false;
  const created = new Date(order.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return created.getTime() >= startOfTodayUtc().getTime();
}

function isPaidStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase().replace(/[_-]+/g, " ");
  return s.includes("captured") || s === "paid" || s.includes("partially refunded");
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
      text: "Could not load today's orders. Try again shortly.",
      replyMarkup: menuKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const today = list.orders.filter(isOrderToday);
  const paid = today.filter((o) => isPaidStatus(o.paymentStatus));
  const unpaid = today.length - paid.length;
  let revenue = 0;
  for (const order of paid) {
    if (typeof order.total === "number" && Number.isFinite(order.total)) {
      revenue += order.total;
    }
  }
  const currency = today[0]?.currencyCode ?? paid[0]?.currencyCode ?? "ETB";
  const revenueLabel = formatMoneyAmount(String(revenue), currency) ?? `${currency} ${revenue}`;

  const lines = [
    `<b>${ctx.tenantName} · Today</b>`,
    `Orders: ${today.length}`,
    `Paid: ${paid.length}`,
    `Unpaid: ${unpaid}`,
    `Paid total: ${revenueLabel}`,
  ];
  if (today.length > 0) {
    lines.push("", "<b>Latest</b>");
    for (const order of today.slice(0, 5)) {
      const pay = order.paymentStatus ? humanizeToken(order.paymentStatus) : "—";
      const total =
        order.total != null
          ? formatMoneyAmount(String(order.total), order.currencyCode ?? undefined) ?? String(order.total)
          : "—";
      lines.push(`• ${formatOrderRef(order.id)} · ${total} · ${pay}`);
    }
  }

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: lines.join("\n"),
    parseMode: "HTML",
    replyMarkup: menuKeyboard(),
  }).catch(() => undefined);
}

function productHits(products: MerchantProduct[]) {
  const hits: NonNullable<TelegramDialogState["hits"]> = [];
  for (const product of products) {
    const variants = product.variants ?? [];
    for (const variant of variants.slice(0, 4)) {
      if (!variant.id) continue;
      hits.push({
        productId: product.id,
        productTitle: product.title ?? "Product",
        variantId: variant.id,
        variantTitle: variant.title ?? "Default",
        sku: variant.sku ?? null,
      });
      if (hits.length >= 6) return hits;
    }
    if (hits.length >= 6) break;
  }
  return hits;
}

function hitsKeyboard(hits: NonNullable<TelegramDialogState["hits"]>) {
  const rows = hits.map((hit, index) => [
    {
      text: `${index + 1}. ${hit.productTitle}${
        hit.variantTitle && hit.variantTitle !== "Default" ? ` · ${hit.variantTitle}` : ""
      }`.slice(0, 60),
      callback_data: `t:i${index}`,
    },
  ]);
  rows.push([{ text: "Cancel", callback_data: "t:close" }]);
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

  const intro =
    input.flow === "stock"
      ? "Send a product name or SKU to update stock."
      : "Send a product name or SKU for this offline sale.";

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: intro,
    replyMarkup: cancelKeyboard(),
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
      text: "Could not search products. Try again.",
      replyMarkup: cancelKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const hits = productHits(result.products);
  if (hits.length === 0) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "No products matched. Send another search, or Cancel.",
      replyMarkup: cancelKeyboard(),
    }).catch(() => undefined);
    return;
  }

  patchDialog(input.telegramUserId, input.chatId, {
    step: "pick_variant",
    hits,
  });

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: "Choose a product:",
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
      text: "Link shop management in the dashboard first.",
      showAlert: true,
    }).catch(() => undefined);
    return { handled: true, reason: "not_operator" };
  }

  const action = data.slice(2);

  if (action === "close") {
    clearDialog(telegramUserId, chatId);
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Closed",
    }).catch(() => undefined);
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text: "Send /menu anytime to open shop tools.",
    }).catch(() => undefined);
    return { handled: true, reason: "close" };
  }

  if (action === "today") {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Today",
    }).catch(() => undefined);
    await sendTodaySummary(deps, chatId, ctx);
    return { handled: true, reason: "today" };
  }

  if (action === "stock" || action === "sale") {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: action === "stock" ? "Stock" : "Offline sale",
    }).catch(() => undefined);
    await beginSearchFlow(deps, {
      chatId,
      telegramUserId,
      ctx,
      flow: action,
    });
    return { handled: true, reason: action };
  }

  if (action === "menu") {
    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: "Menu",
    }).catch(() => undefined);
    clearDialog(telegramUserId, chatId);
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text: `<b>${ctx.tenantName}</b>\nShop tools`,
      parseMode: "HTML",
      replyMarkup: menuKeyboard(),
    }).catch(() => undefined);
    return { handled: true, reason: "menu" };
  }

  // Pick hit by index: t:i0
  const indexMatch = /^i(\d+)$/.exec(action);
  if (indexMatch) {
    const dialog = getDialog(telegramUserId, chatId);
    const hits = dialog?.hits ?? [];
    const index = Number(indexMatch[1]);
    const hit = hits[index];
    if (!dialog || !hit) {
      await answerTelegramCallbackQuery({
        botToken: deps.botToken,
        callbackQueryId: callbackId,
        text: "That choice expired. Start again from the menu.",
        showAlert: true,
      }).catch(() => undefined);
      return { handled: true, reason: "stale_pick" };
    }

    const next = getDialog(telegramUserId, chatId);
    if (next) {
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
    }

    await answerTelegramCallbackQuery({
      botToken: deps.botToken,
      callbackQueryId: callbackId,
      text: hit.productTitle.slice(0, 40),
    }).catch(() => undefined);

    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text:
        dialog.flow === "stock"
          ? `Selected: ${hit.productTitle}${
              hit.variantTitle !== "Default" ? ` · ${hit.variantTitle}` : ""
            }\n\nSend the new stock quantity (whole number).`
          : `Selected: ${hit.productTitle}${
              hit.variantTitle !== "Default" ? ` · ${hit.variantTitle}` : ""
            }\n\nHow many units?`,
      replyMarkup: cancelKeyboard(),
    }).catch(() => undefined);
    return { handled: true, reason: "picked" };
  }

  await answerTelegramCallbackQuery({
    botToken: deps.botToken,
    callbackQueryId: callbackId,
    text: "Unknown action",
  }).catch(() => undefined);
  return { handled: true, reason: "unknown" };
}

/**
 * Handle plain text for tools menu / wizards (not /start connect tokens).
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

  // Bare /start or /menu when linked → tools home.
  const isMenuCommand =
    lower === "/menu" ||
    lower.startsWith("/menu@") ||
    lower === "/start" ||
    /^\/start@\w+$/i.test(lower);

  if (isMenuCommand) {
    if (!ctx) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Link shop management from the dashboard (Settings → Telegram), then send /menu here.",
      }).catch(() => undefined);
      return { handled: true, reason: "not_operator" };
    }
    clearDialog(input.telegramUserId, input.chatId);
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: `<b>${ctx.tenantName}</b>\nShop tools`,
      parseMode: "HTML",
      replyMarkup: menuKeyboard(),
    }).catch(() => undefined);
    return { handled: true, reason: "menu" };
  }

  if (!ctx) {
    return { handled: false, reason: "not_operator" };
  }

  const dialog = getDialog(input.telegramUserId, input.chatId);
  if (!dialog) {
    // Linked operator said something random.
    if (lower === "menu" || lower === "help") {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: `<b>${ctx.tenantName}</b>\nShop tools`,
        parseMode: "HTML",
        replyMarkup: menuKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "menu" };
    }
    return { handled: false, reason: "no_dialog" };
  }

  if (dialog.step === "await_query") {
    if (text.length < 1) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Send a product name or SKU.",
        replyMarkup: cancelKeyboard(),
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
    const qty = Number(text.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Send a whole number quantity (0 or more).",
        replyMarkup: cancelKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "bad_qty" };
    }

    if (dialog.flow === "stock") {
      if (!dialog.stockLocationId || !dialog.productId || !dialog.variantId) {
        clearDialog(input.telegramUserId, input.chatId);
        await sendTelegramBotMessage({
          botToken: deps.botToken,
          chatId: input.chatId,
          text: "Stock location is not set up for this shop.",
          replyMarkup: menuKeyboard(),
        }).catch(() => undefined);
        return { handled: true, reason: "no_location" };
      }

      const updated = await deps.updateMerchantProductVariantStock({
        productId: dialog.productId,
        variantId: dialog.variantId,
        salesChannelId: dialog.salesChannelId,
        stockLocationId: dialog.stockLocationId,
        stockedQuantity: qty,
      });

      clearDialog(input.telegramUserId, input.chatId);
      if (!updated.ok) {
        await sendTelegramBotMessage({
          botToken: deps.botToken,
          chatId: input.chatId,
          text: "Could not update stock. Try again from the dashboard.",
          replyMarkup: menuKeyboard(),
        }).catch(() => undefined);
        return { handled: true, reason: "stock_fail" };
      }

      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: `Stock updated for ${dialog.productTitle ?? "product"} → ${qty}.`,
        replyMarkup: menuKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "stock_ok" };
    }

    // sale: next collect phone
    if (qty < 1) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Quantity must be at least 1 for a sale.",
        replyMarkup: cancelKeyboard(),
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
      text: "Customer phone number?",
      replyMarkup: cancelKeyboard(),
    }).catch(() => undefined);
    return { handled: true, reason: "await_phone" };
  }

  if (dialog.step === "await_phone") {
    const phone = text.replace(/[^\d+]/g, "");
    if (phone.length < 8) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Send a valid phone number.",
        replyMarkup: cancelKeyboard(),
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
      text: "Customer name?",
      replyMarkup: cancelKeyboard(),
    }).catch(() => undefined);
    return { handled: true, reason: "await_name" };
  }

  if (dialog.step === "await_name") {
    if (text.length < 2) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Send the customer name.",
        replyMarkup: cancelKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "bad_name" };
    }

    if (!dialog.regionId || !dialog.variantId || !dialog.quantity) {
      clearDialog(input.telegramUserId, input.chatId);
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "This shop is missing region setup for offline sales.",
        replyMarkup: menuKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "no_region" };
    }

    const { firstName, lastName } = splitName(text);
    const phone = dialog.customerPhone ?? "";
    const created = await deps.createManualOrder({
      customerEmail: syntheticEmail(phone),
      items: [{ quantity: dialog.quantity, variantId: dialog.variantId }],
      note: "Created from Telegram offline sale",
      regionId: dialog.regionId,
      salesChannelId: dialog.salesChannelId,
      shippingAddress: {
        firstName,
        lastName: lastName || null,
        phone,
        city: "Addis Ababa",
        countryCode: "et",
      },
      shippingOptionId: dialog.shippingOptionId,
      tenantId: dialog.tenantId,
      userId: dialog.userId,
    });

    clearDialog(input.telegramUserId, input.chatId);

    if (!created.ok) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Could not create the sale. Try again from the dashboard.",
        replyMarkup: menuKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "sale_fail" };
    }

    const ref = formatOrderRef(created.order.id);
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: [
        `Offline sale created · ${ref}`,
        `${dialog.productTitle ?? "Item"} × ${dialog.quantity}`,
        `${firstName}${lastName ? ` ${lastName}` : ""} · ${phone}`,
      ].join("\n"),
      replyMarkup: menuKeyboard(),
    }).catch(() => undefined);
    return { handled: true, reason: "sale_ok" };
  }

  clearDialog(input.telegramUserId, input.chatId);
  return { handled: false, reason: "unknown_step" };
}
