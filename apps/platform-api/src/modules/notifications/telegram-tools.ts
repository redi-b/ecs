import type { createPlatformDb } from "@ecs/db";
import { domains, tenants } from "@ecs/db";
import { and, eq } from "drizzle-orm";

import type {
  MerchantOrder,
  MerchantProduct,
  MerchantProductsResult,
  MerchantProductStockUpdateResult,
} from "../../types/index.js";
import type { ManualOrderResult } from "../../adapters/medusa/manual-order-service.js";
import { formatMoneyAmount, formatOrderRef } from "./renderer.js";
import {
  answerTelegramCallbackQuery,
  editTelegramMessageText,
  sendTelegramBotMessage,
} from "./providers/telegram-provider.js";
import {
  clearDialog,
  getDialog,
  patchDialog,
  setDialog,
  type TelegramDialogState,
  type TelegramProductHit,
} from "./telegram-dialog-state.js";
import type { TelegramOperatorService } from "./telegram-operator.js";
import {
  MAIN_KEYBOARD_LABELS,
  cancelInline,
  confirmInline,
  itemLabel,
  mainReplyKeyboard,
  ordersListInline,
  phonePromptMarkup,
  productPickInline,
  qtyInline,
  removeReplyKeyboard,
  searchResultsInline,
  shopInlineKeyboard,
  unlinkConfirmInline,
} from "./telegram-keyboards.js";
import { buildRecentProductHits, productHitsFromCatalog } from "./telegram-recent-products.js";
import { buildOrderActionKeyboard } from "./telegram-callback-tokens.js";
import {
  adminUrl,
  formatOrderCardHtml,
  formatOrderListButtonLabel,
  htmlLink,
  resolveDashboardAdminBase,
} from "./telegram-presentation.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type TelegramToolsDeps = {
  db: PlatformDb;
  botToken: string;
  /** HMAC secret for order action buttons on Orders list */
  callbackSecret?: string;
  /** e.g. http://dashboard.lvh.me — used when shop has no primary domain */
  dashboardPublicBaseUrl?: string | null;
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
  bindingId: string;
  role: string;
  salesChannelId: string;
  stockLocationId: string | null;
  regionId: string | null;
  shippingOptionId: string | null;
  tenantName: string;
  tenantHandle: string | null;
  /** Full admin base URL `…/admin` or null */
  adminBase: string | null;
};

function linkToolsHint(adminBase: string | null): string {
  const settings = adminUrl(adminBase, "/settings?tab=telegram");
  if (settings) {
    return `Shop tools need a management link.\nOpen ${htmlLink(settings, "Settings → Telegram")}.`;
  }
  return "Shop tools need a management link.\nOpen Settings → Telegram in the dashboard.";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
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

function parseQty(text: string, min: number): number | null {
  const cleaned = text.trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const qty = Number(cleaned);
  if (!Number.isInteger(qty) || qty < min) return null;
  return qty;
}

function dialogBase(
  ctx: OperatorCtx,
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
      handle: tenants.handle,
      primaryDomainId: tenants.primaryDomainId,
    })
    .from(tenants)
    .where(eq(tenants.id, op.tenantId))
    .limit(1);

  const salesChannelId = tenant?.medusaSalesChannelId?.trim();
  if (!salesChannelId) return null;

  let hostname: string | null = null;
  if (tenant?.primaryDomainId) {
    const [domain] = await deps.db
      .select({ hostname: domains.hostname })
      .from(domains)
      .where(and(eq(domains.id, tenant.primaryDomainId), eq(domains.tenantId, op.tenantId)))
      .limit(1);
    hostname = domain?.hostname?.trim() || null;
  }

  const adminBase = resolveDashboardAdminBase({
    primaryHostname: hostname,
    fallbackBaseUrl: deps.dashboardPublicBaseUrl ?? null,
  });

  return {
    tenantId: op.tenantId,
    userId: op.userId,
    bindingId: op.bindingId,
    role: op.role,
    salesChannelId,
    stockLocationId: tenant?.medusaStockLocationId?.trim() || null,
    regionId: tenant?.medusaRegionId?.trim() || null,
    shippingOptionId: tenant?.medusaShippingOptionId?.trim() || null,
    tenantName: tenant?.name?.trim() || op.tenantName || "Your shop",
    tenantHandle: tenant?.handle?.trim() || op.tenantHandle || null,
    adminBase,
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

async function denyNotOperator(deps: TelegramToolsDeps, chatId: string) {
  const adminBase = resolveDashboardAdminBase({
    primaryHostname: null,
    fallbackBaseUrl: deps.dashboardPublicBaseUrl ?? null,
  });
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: linkToolsHint(adminBase),
    parseMode: "HTML",
  }).catch(() => undefined);
}

async function sendHome(deps: TelegramToolsDeps, chatId: string, ctx: OperatorCtx) {
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: `<b>${ctx.tenantName}</b>`,
    parseMode: "HTML",
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);
}

async function sendHelp(deps: TelegramToolsDeps, chatId: string, ctx: OperatorCtx) {
  const telegramSettings = adminUrl(ctx.adminBase, "/settings?tab=telegram");
  const notifications = adminUrl(ctx.adminBase, "/settings?tab=notifications");
  const lines = [
    `<b>${ctx.tenantName}</b>`,
    "",
    "<b>New sale</b> — offline sale (customer phone after qty)",
    "<b>Stock</b> — update inventory",
    "<b>Today</b> — today’s orders and paid total",
    "<b>Orders</b> — recent orders and actions",
    "<b>Shop</b> — shop details, dashboard, unlink",
    "",
  ];
  if (telegramSettings) {
    lines.push(htmlLink(telegramSettings, "Settings → Telegram"));
  } else {
    lines.push("Settings → Telegram");
  }
  if (notifications) {
    lines.push(htmlLink(notifications, "Settings → Notifications"));
  } else {
    lines.push("Settings → Notifications");
  }

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: lines.join("\n"),
    parseMode: "HTML",
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);
}

async function sendShop(deps: TelegramToolsDeps, chatId: string, ctx: OperatorCtx) {
  const saleReady = Boolean(ctx.regionId && ctx.shippingOptionId);
  const stockReady = Boolean(ctx.stockLocationId);
  const roleLabel = ctx.role ? ctx.role.charAt(0).toUpperCase() + ctx.role.slice(1) : "Manager";

  const lines = [
    `<b>${ctx.tenantName}</b>`,
    ctx.tenantHandle ? `@${ctx.tenantHandle} · ${roleLabel}` : roleLabel,
    "",
    saleReady ? "Offline sales: ready" : "Offline sales: missing region/shipping setup",
    stockReady ? "Stock updates: ready" : "Stock updates: missing stock location",
  ];

  const dashboard = adminUrl(ctx.adminBase, "");
  const ordersPage = adminUrl(ctx.adminBase, "/orders");
  const telegramSettings = adminUrl(ctx.adminBase, "/settings?tab=telegram");

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: lines.join("\n"),
    parseMode: "HTML",
    replyMarkup: shopInlineKeyboard({
      dashboard,
      orders: ordersPage,
      telegramSettings,
    }),
  }).catch(() => undefined);
}

async function sendUnlinkConfirm(deps: TelegramToolsDeps, chatId: string, ctx: OperatorCtx) {
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: [
      `<b>Unlink Telegram?</b>`,
      `Removes shop tools for <b>${ctx.tenantName}</b> on this account.`,
      "You can link again from the dashboard.",
      "Order alerts stay if this chat is connected under Notifications.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: unlinkConfirmInline(),
  }).catch(() => undefined);
}

async function performUnlink(
  deps: TelegramToolsDeps,
  input: { chatId: string; telegramUserId: string; ctx: OperatorCtx },
) {
  const result = await deps.operatorService.unlinkSelf({
    telegramUserId: input.telegramUserId,
    tenantId: input.ctx.tenantId,
    bindingId: input.ctx.bindingId,
  });
  clearDialog(input.telegramUserId, input.chatId);
  if (!result.ok) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Could not unlink. Try again from the dashboard.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: `Unlinked from <b>${input.ctx.tenantName}</b>.\nShop tools are off for this chat.`,
    parseMode: "HTML",
    replyMarkup: removeReplyKeyboard(),
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
      text: "Could not load orders.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const today = list.orders.filter(isOrderToday);
  if (today.length === 0) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId,
      text: `<b>${ctx.tenantName}</b>\nNo orders today.`,
      parseMode: "HTML",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const paid = today.filter((o) => isPaidStatus(o.paymentStatus));
  let revenue = 0;
  for (const order of paid) {
    if (typeof order.total === "number" && Number.isFinite(order.total)) revenue += order.total;
  }
  const currency = today[0]?.currencyCode ?? "ETB";
  const revenueLabel = formatMoneyAmount(String(revenue), currency) ?? String(revenue);

  const lines = [
    `<b>${ctx.tenantName}</b>`,
    `<b>Today</b>`,
    `${today.length} orders · ${paid.length} paid · ${today.length - paid.length} unpaid`,
    `Paid total ${revenueLabel}`,
    "",
  ];
  for (const order of today.slice(0, 5)) {
    lines.push(`· ${formatOrderListButtonLabel(order)}`);
  }

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: lines.join("\n"),
    parseMode: "HTML",
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);
}

async function sendOrEdit(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    /** Loading placeholder message to replace, if any */
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

async function sendOrdersList(
  deps: TelegramToolsDeps,
  input: { chatId: string; telegramUserId: string; ctx: OperatorCtx },
) {
  const loading = await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: "Loading orders…",
    replyMarkup: cancelInline(),
  }).catch(() => null);

  const list = await deps.listMerchantOrders({
    limit: 8,
    offset: 0,
    salesChannelId: input.ctx.salesChannelId,
  });
  if (!list.ok) {
    await sendOrEdit(deps, {
      chatId: input.chatId,
      messageId: loading?.messageId ?? null,
      text: "Could not load orders.",
      replyMarkup: mainReplyKeyboard(),
    });
    return;
  }
  if (list.orders.length === 0) {
    await sendOrEdit(deps, {
      chatId: input.chatId,
      messageId: loading?.messageId ?? null,
      text: "No recent orders.",
      replyMarkup: mainReplyKeyboard(),
    });
    return;
  }

  const rows = list.orders.map((order) => ({
    id: order.id,
    label: formatOrderListButtonLabel(order),
  }));

  setDialog(input.telegramUserId, input.chatId, {
    ...dialogBase(input.ctx, "orders", "orders_list"),
    orderIds: rows.map((r) => r.id),
  });

  await sendOrEdit(deps, {
    chatId: input.chatId,
    messageId: loading?.messageId ?? null,
    text: `<b>Recent orders</b>\nTap one to open.`,
    parseMode: "HTML",
    replyMarkup: ordersListInline(rows),
  });
}

async function searchProducts(
  deps: TelegramToolsDeps,
  ctx: OperatorCtx,
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
  ctx: OperatorCtx,
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

async function startProductPick(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    ctx: OperatorCtx;
    flow: "sale" | "stock";
  },
) {
  const title =
    input.flow === "sale"
      ? "<b>New sale</b>\nPick a product"
      : "<b>Stock</b>\nPick a product";
  const loading = await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: "Loading products…",
    replyMarkup: cancelInline(),
  }).catch(() => null);

  const hits = await loadPickHits(deps, input.ctx);
  setDialog(input.telegramUserId, input.chatId, {
    ...dialogBase(input.ctx, input.flow, "pick_product"),
    hits,
  });

  if (hits.length === 0) {
    const emptyHint = adminUrl(input.ctx.adminBase, "/products");
    await sendOrEdit(deps, {
      chatId: input.chatId,
      messageId: loading?.messageId ?? null,
      text: [
        title,
        "No products yet. Tap Search, or add products in the dashboard.",
        emptyHint ? htmlLink(emptyHint, "Open products") : null,
      ]
        .filter(Boolean)
        .join("\n"),
      parseMode: "HTML",
      replyMarkup: productPickInline([]),
    });
    return;
  }

  await sendOrEdit(deps, {
    chatId: input.chatId,
    messageId: loading?.messageId ?? null,
    text: title,
    parseMode: "HTML",
    replyMarkup: productPickInline(hits),
  });
}

async function advanceAfterProduct(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    ctx: OperatorCtx;
    flow: "sale" | "stock";
    hit: TelegramProductHit;
  },
) {
  setDialog(input.telegramUserId, input.chatId, {
    ...dialogBase(input.ctx, input.flow, "await_qty"),
    productId: input.hit.productId,
    variantId: input.hit.variantId,
    productTitle: input.hit.productTitle,
    variantTitle: input.hit.variantTitle,
  });

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      `<b>${itemLabel(input.hit.productTitle, input.hit.variantTitle)}</b>`,
      input.flow === "sale" ? "How many? Tap a number or type one." : "New quantity? Tap a number or type one.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: qtyInline(input.flow),
  }).catch(() => undefined);
}

async function goToContactOrConfirmStock(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    ctx: OperatorCtx;
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

  // sale
  const saleNext: Omit<TelegramDialogState, "expiresAt"> = {
    ...dialogBase(input.ctx, "sale", "await_contact"),
    quantity: input.qty,
  };
  if (input.dialog.productId) saleNext.productId = input.dialog.productId;
  if (input.dialog.variantId) saleNext.variantId = input.dialog.variantId;
  if (input.dialog.productTitle) saleNext.productTitle = input.dialog.productTitle;
  if (input.dialog.variantTitle) saleNext.variantTitle = input.dialog.variantTitle;
  setDialog(input.telegramUserId, input.chatId, saleNext);
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      `${itemLabel(input.dialog.productTitle, input.dialog.variantTitle)} × ${input.qty}`,
      "Type the <b>customer’s</b> phone number.",
      "Or use 📎 → Contact to pick them from your phone.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: phonePromptMarkup(),
  }).catch(() => undefined);
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
    text: `Stock · ${itemLabel(input.dialog.productTitle, input.dialog.variantTitle)} → ${input.qty}`,
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
    customerPhone: string;
  },
) {
  if (!input.dialog.regionId || !input.dialog.variantId || !input.dialog.quantity) {
    clearDialog(input.telegramUserId, input.chatId);
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Shop is not ready for offline sales.",
      replyMarkup: mainReplyKeyboard(),
    }).catch(() => undefined);
    return;
  }

  const { firstName, lastName } = splitName(input.customerName);
  const created = await deps.createManualOrder({
    customerEmail: syntheticEmail(input.customerPhone),
    items: [{ quantity: input.dialog.quantity, variantId: input.dialog.variantId }],
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
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      `Sale ${formatOrderRef(created.order.id)}`,
      `${itemLabel(input.dialog.productTitle, input.dialog.variantTitle)} × ${input.dialog.quantity}`,
      whoLine,
    ].join("\n"),
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);
}

async function showSaleConfirm(
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
  if (phone.length < 8 || !input.dialog.quantity || input.dialog.quantity < 1) {
    await sendTelegramBotMessage({
      botToken: deps.botToken,
      chatId: input.chatId,
      text: "Need a valid customer phone (and quantity ≥ 1).",
      replyMarkup: phonePromptMarkup(),
    }).catch(() => undefined);
    return;
  }

  patchDialog(input.telegramUserId, input.chatId, {
    step: "confirm_sale",
    customerPhone: phone,
    customerName: input.name || "Customer",
  });

  const displayName = (input.name || "").trim();
  const who =
    displayName && !/^customer$/i.test(displayName) ? `${displayName} · ${phone}` : phone;

  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId: input.chatId,
    text: [
      `<b>Confirm sale</b>`,
      `${itemLabel(input.dialog.productTitle, input.dialog.variantTitle)} × ${input.dialog.quantity}`,
      who,
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: confirmInline(),
  }).catch(() => undefined);
}

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
      text: "Type product name or SKU",
      replyMarkup: cancelInline(),
    }).catch(() => undefined);
    return { handled: true, reason: "search" };
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
      dialog.quantity &&
      dialog.quantity >= 1
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
    if (
      !dialog ||
      !hit ||
      (dialog.step !== "pick_product" && dialog.step !== "search")
    ) {
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
    if (!dialog || dialog.flow !== "sale" || dialog.step !== "await_contact" || !dialog.quantity) {
      await sendTelegramBotMessage({
        botToken: deps.botToken,
        chatId: input.chatId,
        text: "Start with New sale first.",
        replyMarkup: mainReplyKeyboard(),
      }).catch(() => undefined);
      return { handled: true, reason: "contact_no_sale" };
    }
    const name =
      [input.contact.firstName, input.contact.lastName].filter(Boolean).join(" ").trim() ||
      "Customer";
    await showSaleConfirm(deps, {
      chatId: input.chatId,
      telegramUserId: input.telegramUserId,
      dialog,
      phone: input.contact.phone,
      name,
    });
    return { handled: true, reason: "confirm_sale" };
  }

  const isMenu =
    lower === "/menu" ||
    lower.startsWith("/menu@") ||
    lower === "menu" ||
    lower === MAIN_KEYBOARD_LABELS.cancel.toLowerCase() ||
    lower === "/cancel" ||
    lower.startsWith("/cancel@");
  const isToday =
    lower === MAIN_KEYBOARD_LABELS.today.toLowerCase() ||
    lower === "/today" ||
    lower.startsWith("/today@");
  const isStock =
    lower === MAIN_KEYBOARD_LABELS.stock.toLowerCase() ||
    lower === "/stock" ||
    lower.startsWith("/stock@");
  const isSale =
    lower === MAIN_KEYBOARD_LABELS.newSale.toLowerCase() ||
    lower === "/sale" ||
    lower.startsWith("/sale@");
  const isOrders =
    lower === MAIN_KEYBOARD_LABELS.orders.toLowerCase() ||
    lower === "/orders" ||
    lower.startsWith("/orders@");
  const isShop =
    lower === MAIN_KEYBOARD_LABELS.shop.toLowerCase() ||
    lower === "/shop" ||
    lower.startsWith("/shop@");
  const isHelp =
    lower === MAIN_KEYBOARD_LABELS.help.toLowerCase() ||
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
    if (hits.length === 1) {
      await advanceAfterProduct(deps, {
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        ctx,
        flow: dialog.flow === "stock" ? "stock" : "sale",
        hit: hits[0]!,
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
    await showSaleConfirm(deps, {
      chatId: input.chatId,
      telegramUserId: input.telegramUserId,
      dialog,
      phone,
      name: "Customer",
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
