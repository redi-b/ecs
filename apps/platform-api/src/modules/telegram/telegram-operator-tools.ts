import { domains, tenants } from "@ecs/db";
import { and, eq } from "drizzle-orm";
import type { MerchantOrder } from "../../types/index.js";
import { sendTelegramBotMessage } from "../notifications/providers/telegram-provider.js";
import { formatMoneyAmount } from "../notifications/renderer.js";
import { clearDialog, setDialog } from "./telegram-dialog-state.js";
import {
  cancelInline,
  mainReplyKeyboard,
  ordersListInline,
  removeReplyKeyboard,
  shopInlineKeyboard,
  unlinkConfirmInline,
} from "./telegram-keyboards.js";
import {
  adminUrl,
  formatOrderListButtonLabel,
  htmlLink,
  resolveDashboardAdminBase,
} from "./telegram-presentation.js";
import type { TelegramOperatorContext, TelegramToolsDeps } from "./telegram-tools-contract.js";
import { dialogBase, sendOrEdit } from "./telegram-tools-shared.js";

function linkToolsHint(adminBase: string | null): string {
  const settings = adminUrl(adminBase, "/settings?tab=telegram");
  if (settings) {
    return `Shop tools need a management link.\nOpen ${htmlLink(settings, "Settings → Telegram")}.`;
  }
  return "Shop tools need a management link.\nOpen Settings → Telegram in the dashboard.";
}

export async function resolveOperatorContext(
  deps: TelegramToolsDeps,
  telegramUserId: string,
): Promise<TelegramOperatorContext | null> {
  const { operators } = await deps.operatorService.resolveOperator({ telegramUserId });
  const op = operators[0];
  if (!op) return null;
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

export async function denyNotOperator(deps: TelegramToolsDeps, chatId: string) {
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

export async function sendHome(
  deps: TelegramToolsDeps,
  chatId: string,
  ctx: TelegramOperatorContext,
) {
  await sendTelegramBotMessage({
    botToken: deps.botToken,
    chatId,
    text: [`🏪 <b>${ctx.tenantName}</b>`, "Use the buttons below to manage the shop."].join("\n"),
    parseMode: "HTML",
    replyMarkup: mainReplyKeyboard(),
  }).catch(() => undefined);
}

export async function sendHelp(
  deps: TelegramToolsDeps,
  chatId: string,
  ctx: TelegramOperatorContext,
) {
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

export async function sendShop(
  deps: TelegramToolsDeps,
  chatId: string,
  ctx: TelegramOperatorContext,
) {
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

export async function sendUnlinkConfirm(
  deps: TelegramToolsDeps,
  chatId: string,
  ctx: TelegramOperatorContext,
) {
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

export async function performUnlink(
  deps: TelegramToolsDeps,
  input: { chatId: string; telegramUserId: string; ctx: TelegramOperatorContext },
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

export async function sendTodaySummary(
  deps: TelegramToolsDeps,
  chatId: string,
  ctx: TelegramOperatorContext,
) {
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

export async function sendOrdersList(
  deps: TelegramToolsDeps,
  input: { chatId: string; telegramUserId: string; ctx: TelegramOperatorContext },
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
