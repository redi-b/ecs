import type { TelegramProductHit } from "./telegram-dialog-state.js";

export const MAIN_KEYBOARD_LABELS = {
  newSale: "New sale",
  stock: "Stock",
  today: "Today",
  orders: "Orders",
  help: "Help",
  cancel: "Cancel",
  shareContact: "Share contact",
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
      [{ text: MAIN_KEYBOARD_LABELS.orders }, { text: MAIN_KEYBOARD_LABELS.help }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function contactReplyKeyboard() {
  return {
    keyboard: [
      [{ text: MAIN_KEYBOARD_LABELS.shareContact, request_contact: true }],
      [{ text: MAIN_KEYBOARD_LABELS.cancel }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
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
  const t = (title ?? "Item").trim();
  const v = (variant ?? "").trim();
  if (!v || v === "Default" || v === t) return t;
  return `${t} · ${v}`;
}

export function hitButtonLabel(hit: TelegramProductHit): string {
  const base = itemLabel(hit.productTitle, hit.variantTitle);
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
