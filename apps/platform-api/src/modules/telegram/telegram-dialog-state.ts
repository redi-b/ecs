/**
 * In-memory multi-step Telegram dialog state (single process).
 * Good enough for local/dev and single-node deploys; multi-instance should move to Redis later.
 */

export type TelegramDialogFlow = "sale" | "stock" | "orders" | "idle";

export type TelegramDialogStep =
  | "pick_product"
  | "search"
  | "await_qty"
  | "await_contact"
  | "await_email"
  | "confirm_sale"
  | "confirm_stock"
  | "orders_list";

export type TelegramProductHit = {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  sku?: string | null;
  availableQuantity?: number | null;
};

export type TelegramDialogState = {
  flow: TelegramDialogFlow;
  step: TelegramDialogStep;
  tenantId: string;
  userId: string;
  salesChannelId: string;
  stockLocationId: string | null;
  regionId: string | null;
  shippingOptionId: string | null;
  hits?: TelegramProductHit[];
  /** Parallel to t:o{n} callbacks on orders_list */
  orderIds?: string[];
  productId?: string;
  variantId?: string;
  productTitle?: string;
  variantTitle?: string;
  quantity?: number;
  customerPhone?: string;
  customerName?: string;
  /** Real email or shop walk-in address used for Medusa customer/order. */
  customerEmail?: string;
  expiresAt: number;
};

const TTL_MS = 20 * 60 * 1000;
const store = new Map<string, TelegramDialogState>();

function key(telegramUserId: string, chatId: string) {
  return `${telegramUserId}:${chatId}`;
}

export function getDialog(telegramUserId: string, chatId: string): TelegramDialogState | null {
  const k = key(telegramUserId, chatId);
  const row = store.get(k);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    store.delete(k);
    return null;
  }
  return row;
}

export function setDialog(
  telegramUserId: string,
  chatId: string,
  state: Omit<TelegramDialogState, "expiresAt"> & { expiresAt?: number },
) {
  store.set(key(telegramUserId, chatId), {
    ...state,
    expiresAt: state.expiresAt ?? Date.now() + TTL_MS,
  });
}

export function patchDialog(
  telegramUserId: string,
  chatId: string,
  patch: Partial<TelegramDialogState>,
) {
  const current = getDialog(telegramUserId, chatId);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    expiresAt: Date.now() + TTL_MS,
  };
  store.set(key(telegramUserId, chatId), next);
  return next;
}

export function clearDialog(telegramUserId: string, chatId: string) {
  store.delete(key(telegramUserId, chatId));
}
