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
import { formatMoneyAmount, formatOrderRef } from "../notifications/renderer.js";
import {
  answerTelegramCallbackQuery,
  editTelegramMessageText,
  sendTelegramBotMessage,
} from "../notifications/providers/telegram-provider.js";
import {
  clearDialog,
  getDialog,
  patchDialog,
  setDialog,
  type TelegramCartLine,
  type TelegramDialogState,
  type TelegramProductHit,
} from "./telegram-dialog-state.js";
import type { TelegramOperatorService } from "./telegram-operator.js";
import {
  MAIN_KEYBOARD_LABELS,
  cancelInline,
  cartMenuInline,
  confirmInline,
  emailPromptMarkup,
  formatCartSummary,
  itemLabel,
  mainReplyKeyboard,
  matchesMainLabel,
  namePromptMarkup,
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
  formatItemLine,
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
    customerId?: string | null;
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
  /** Find-or-create customer by email in this shop (Medusa requires email). */
  ensureMerchantCustomer?: (input: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    tenantId: string;
  }) => Promise<
    | { ok: true; customer: { id: string; email: string } }
    | { ok: false; error: string; status: number }
  >;
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

/** One shared offline customer email per shop when the operator chooses Walk-in. */
function walkInEmail(tenantHandle: string | null): string {
  const handle =
    (tenantHandle ?? "shop")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "shop";
  return `walk-in@${handle}.local`;
}

function isValidCustomerEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  if (email.length < 5 || email.length > 120) return false;
  // Simple merchant-friendly check (not full RFC).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isWalkInEmail(email: string): boolean {
  return /^walk-in@/i.test(email.trim()) && email.trim().toLowerCase().endsWith(".local");
}

/**
 * Medusa needs an email on the order/customer record.
 * - Real email: find-or-create that customer; store name + phone on the profile.
 * - Walk-in: one stable offline customer per shop. Name/phone stay on the *order*
 *   only so the Customers list does not thrash with every counter sale.
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
  if (!deps.ensureMerchantCustomer) {
    return { email };
  }

  const walkIn = isWalkInEmail(email);
  const ensured = await deps.ensureMerchantCustomer({
    tenantId: input.tenantId,
    email,
    // Shared walk-in profile stays generic; per-sale phone/name go on the order.
    phone: walkIn ? null : input.phone,
    firstName: walkIn
      ? "Walk-in"
      : input.firstName && !/^customer$/i.test(input.firstName)
        ? input.firstName
        : null,
    lastName: walkIn ? null : input.lastName || null,
  });
  if (ensured.ok) {
    return { email: ensured.customer.email || email, customerId: ensured.customer.id };
  }
  return { email };
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
    text: [`🏪 <b>${ctx.tenantName}</b>`, "Use the buttons below to manage the shop."].join("\n"),
    parseMode: "HTML",
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);
}

async function sendHelp(deps: TelegramToolsDeps, chatId: string, ctx: OperatorCtx) {
  const telegramSettings = adminUrl(ctx.adminBase, "/settings?tab=telegram");
  const notifications = adminUrl(ctx.adminBase, "/settings?tab=notifications");
  const lines = [
    `🏪 <b>${ctx.tenantName}</b>`,
    "",
    "🛒 <b>New sale</b> — offline order (one or more products)",
    "📦 <b>Stock</b> — update inventory",
    "📊 <b>Today</b> — today’s orders and paid total",
    "📋 <b>Orders</b> — recent orders and actions",
    "🏪 <b>Shop</b> — status, dashboard links, unlink",
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
    `🏪 <b>${ctx.tenantName}</b>`,
    ctx.tenantHandle ? `@${ctx.tenantHandle} · ${roleLabel}` : roleLabel,
    "",
    saleReady ? "✅ Offline sales ready" : "⚠️ Offline sales need region/shipping setup",
    stockReady ? "✅ Stock updates ready" : "⚠️ Stock needs a stock location",
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
    `🏪 <b>${ctx.tenantName}</b>`,
    "📊 <b>Today</b>",
    `${today.length} orders · ${paid.length} paid · ${today.length - paid.length} unpaid`,
    `💰 Paid total ${revenueLabel}`,
    "",
  ];
  for (const order of today.slice(0, 5)) {
    lines.push(`• ${formatOrderListButtonLabel(order)}`);
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

function cartFromDialog(dialog: TelegramDialogState): TelegramCartLine[] {
  return Array.isArray(dialog.cart) ? [...dialog.cart] : [];
}

function mergeCartLine(cart: TelegramCartLine[], line: TelegramCartLine): TelegramCartLine[] {
  const next = [...cart];
  const index = next.findIndex((row) => row.variantId === line.variantId);
  if (index >= 0) {
    const existing = next[index]!;
    next[index] = { ...existing, quantity: existing.quantity + line.quantity };
    return next;
  }
  next.push(line);
  return next;
}

function saleItemsFromDialog(dialog: TelegramDialogState): Array<{ quantity: number; variantId: string }> {
  const cart = cartFromDialog(dialog);
  if (cart.length > 0) {
    return cart.map((line) => ({ quantity: line.quantity, variantId: line.variantId }));
  }
  if (dialog.variantId && dialog.quantity && dialog.quantity >= 1) {
    return [{ quantity: dialog.quantity, variantId: dialog.variantId }];
  }
  return [];
}

async function startProductPick(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    ctx: OperatorCtx;
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
  const previous = getDialog(input.telegramUserId, input.chatId);
  const existingCart =
    input.flow === "sale" && previous ? cartFromDialog(previous) : [];
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

async function beginSaleCheckout(
  deps: TelegramToolsDeps,
  input: {
    chatId: string;
    telegramUserId: string;
    ctx: OperatorCtx;
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
    text: `📦 Stock updated · ${itemLabel(input.dialog.productTitle, input.dialog.variantTitle)} → <b>${input.qty}</b>`,
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
      : formatItemLine(
          input.dialog.productTitle,
          input.dialog.variantTitle,
          input.dialog.quantity,
        );
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

async function promptCustomerName(
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

async function promptCustomerEmail(
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
  const who =
    displayName && !/^customer$/i.test(displayName) ? `${displayName} · ${phone}` : phone;

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

async function showSaleConfirm(
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
  const who =
    displayName && !/^customer$/i.test(displayName) ? `${displayName} · ${phone}` : phone;
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
      (dialog.step !== "cart_menu" &&
        dialog.step !== "pick_product" &&
        dialog.step !== "search")
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
    if (!dialog || dialog.flow !== "sale" || dialog.step !== "await_name" || !dialog.customerPhone) {
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
      email: walkInEmail(ctx.tenantHandle),
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
