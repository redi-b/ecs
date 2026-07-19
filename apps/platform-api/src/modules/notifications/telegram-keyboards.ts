import type { TelegramProductHit } from "./telegram-dialog-state.js";
import { formatItemLine } from "./telegram-presentation.js";

export const MAIN_KEYBOARD_LABELS = {
  newSale: "New sale",
  stock: "Stock",
  today: "Today",
  orders: "Orders",
  shop: "Shop",
  help: "Help",
  cancel: "Cancel",
  search: "Search",
} as const;

export function mainReplyKeyboard() {
  return {
    keyboard: [
      [
        { text: MAIN_KEYBOARD_LABELS.newSale },
        { text: MAIN_KEYBOARD_LABELS.stock },
        { text: MAIN_KEYBOARD_LABELS.today },
      ],
      [
        { text: MAIN_KEYBOARD_LABELS.orders },
        { text: MAIN_KEYBOARD_LABELS.shop },
        { text: MAIN_KEYBOARD_LABELS.help },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function removeReplyKeyboard() {
  return { remove_keyboard: true };
}

export function shopInlineKeyboard(links: {
  dashboard?: string | null;
  orders?: string | null;
  telegramSettings?: string | null;
}) {
  const rows: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];
  const openRow: Array<{ text: string; url: string }> = [];
  if (links.dashboard) openRow.push({ text: "Dashboard", url: links.dashboard });
  if (links.orders) openRow.push({ text: "Orders", url: links.orders });
  if (openRow.length) rows.push(openRow);
  if (links.telegramSettings) {
    rows.push([{ text: "Settings → Telegram", url: links.telegramSettings }]);
  }
  rows.push([
    { text: "Unlink", callback_data: "t:unlink" },
    { text: "Close", callback_data: "t:menu" },
  ]);
  return { inline_keyboard: rows };
}

export function unlinkConfirmInline() {
  return {
    inline_keyboard: [
      [
        { text: "Yes, unlink", callback_data: "t:unlink_ok" },
        { text: "Keep linked", callback_data: "t:shop" },
      ],
    ],
  };
}

/**
 * Telegram request_contact only sends the *operator's* own number, not a customer.
 * For sales we ask for a typed phone (or an attached contact via the paperclip).
 */
export function phonePromptMarkup() {
  return {
    inline_keyboard: [[{ text: "Cancel", callback_data: "t:menu" }]],
    // Keep shop keyboard visible underneath after the step ends.
  };
}

export function cancelInline() {
  return { inline_keyboard: [[{ text: "Cancel", callback_data: "t:menu" }]] };
}

export function confirmInline() {
  return {
    inline_keyboard: [
      [
        { text: "Confirm", callback_data: "t:ok" },
        { text: "Cancel", callback_data: "t:menu" },
      ],
    ],
  };
}

/** Sale: never include 0. Stock: Out = q0. */
export function qtyInline(flow: "sale" | "stock") {
  const chips =
    flow === "sale"
      ? [
          { text: "1", callback_data: "t:q1" },
          { text: "2", callback_data: "t:q2" },
          { text: "3", callback_data: "t:q3" },
          { text: "5", callback_data: "t:q5" },
        ]
      : [
          { text: "Out", callback_data: "t:q0" },
          { text: "5", callback_data: "t:q5" },
          { text: "10", callback_data: "t:q10" },
          { text: "20", callback_data: "t:q20" },
        ];
  return {
    inline_keyboard: [chips, [{ text: "Cancel", callback_data: "t:menu" }]],
  };
}

export function itemLabel(title?: string, variant?: string) {
  return formatItemLine(title, variant);
}

/**
 * Button text: product · variant · stock.
 * Always try to show variant when non-default so multi-variant products don't look identical.
 */
export function hitButtonLabel(hit: TelegramProductHit): string {
  const title = (hit.productTitle ?? "Item").trim() || "Item";
  const variant = (hit.variantTitle ?? "").trim();
  const showVariant = Boolean(variant && !/^default$/i.test(variant) && variant !== title);
  let base = showVariant ? `${title} · ${variant}` : title;
  if (!showVariant && hit.sku?.trim()) {
    base = `${title} · ${hit.sku.trim()}`;
  }
  const qty =
    hit.availableQuantity != null && Number.isFinite(hit.availableQuantity)
      ? ` · ${hit.availableQuantity} left`
      : "";
  return `${base}${qty}`.slice(0, 56);
}

export function productPickInline(hits: TelegramProductHit[]) {
  return {
    inline_keyboard: [
      ...hits.map((hit, index) => [
        { text: hitButtonLabel(hit), callback_data: `t:i${index}` },
      ]),
      [
        { text: "Search", callback_data: "t:search" },
        { text: "Cancel", callback_data: "t:menu" },
      ],
    ],
  };
}

export function searchResultsInline(hits: TelegramProductHit[]) {
  return {
    inline_keyboard: [
      ...hits.map((hit, index) => [
        { text: hitButtonLabel(hit), callback_data: `t:i${index}` },
      ]),
      [{ text: "Cancel", callback_data: "t:menu" }],
    ],
  };
}

export function ordersListInline(rows: Array<{ id: string; label: string }>) {
  return {
    inline_keyboard: [
      ...rows.map((row, index) => [
        { text: row.label.slice(0, 56), callback_data: `t:o${index}` },
      ]),
      [{ text: "Close", callback_data: "t:menu" }],
    ],
  };
}
