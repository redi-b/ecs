/**
 * In-memory multi-step Telegram dialog state (single process).
 * Good enough for local/dev and single-node deploys; multi-instance should move to Redis later.
 */

export type TelegramDialogFlow = "stock" | "sale" | "idle";

export type TelegramDialogState = {
  flow: TelegramDialogFlow;
  step: string;
  tenantId: string;
  userId: string;
  salesChannelId: string;
  stockLocationId: string | null;
  regionId: string | null;
  shippingOptionId: string | null;
  /** Search hit list for the current step (indexes map to callbacks). */
  hits?: Array<{
    productId: string;
    productTitle: string;
    variantId: string;
    variantTitle: string;
    sku?: string | null;
  }>;
  productId?: string;
  variantId?: string;
  productTitle?: string;
  variantTitle?: string;
  quantity?: number;
  customerPhone?: string;
  customerName?: string;
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
