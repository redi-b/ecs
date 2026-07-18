import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Telegram callback_data max length is 64 bytes.
 * Codes are single letters so several actions fit with Medusa order ids.
 */
export type TelegramOrderAction = "paid" | "ready" | "cancel" | "details";

const ACTION_CODE: Record<TelegramOrderAction, string> = {
  paid: "p",
  ready: "r",
  cancel: "c",
  details: "d",
};

const CODE_ACTION: Record<string, TelegramOrderAction> = {
  p: "paid",
  r: "ready",
  c: "cancel",
  d: "details",
};

/** Default: 48 hours for order alert buttons. */
const DEFAULT_TTL_SEC = 48 * 60 * 60;

export function createTelegramCallbackSecret(env: {
  TELEGRAM_WEBHOOK_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
}) {
  return (
    env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
    env.BETTER_AUTH_SECRET?.trim() ||
    "development-telegram-callback-secret"
  );
}

function sign(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 12);
}

function safeEqualHex(a: string, b: string) {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Build callback_data for an order action button.
 * Format: `{code}|{orderId}|{exp}|{sig12}`
 */
export function buildOrderActionCallbackData(input: {
  action: TelegramOrderAction;
  orderId: string;
  tenantId: string;
  secret: string;
  ttlSec?: number;
}): string | null {
  const orderId = input.orderId.trim();
  if (!orderId || orderId.length > 40) return null;
  const exp = Math.floor(Date.now() / 1000) + (input.ttlSec ?? DEFAULT_TTL_SEC);
  const code = ACTION_CODE[input.action];
  const payload = `${code}|${orderId}|${exp}|${input.tenantId}`;
  const sig = sign(input.secret, payload);
  const data = `${code}|${orderId}|${exp}|${sig}`;
  if (Buffer.byteLength(data, "utf8") > 64) return null;
  return data;
}

export function parseOrderActionCallbackData(
  data: string,
  input: {
    secret: string;
    tenantIds: string[];
  },
):
  | { ok: true; action: TelegramOrderAction; orderId: string; tenantId: string }
  | { ok: false; reason: "invalid" | "expired" | "bad_sig" } {
  const parts = data.trim().split("|");
  if (parts.length !== 4) return { ok: false, reason: "invalid" };
  const [code, orderId, expRaw, sig] = parts;
  if (!code || !orderId || !expRaw || !sig) return { ok: false, reason: "invalid" };
  const action = CODE_ACTION[code];
  if (!action) return { ok: false, reason: "invalid" };
  const exp = Number(expRaw);
  if (!Number.isFinite(exp)) return { ok: false, reason: "invalid" };
  if (exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };

  for (const tenantId of input.tenantIds) {
    const payload = `${code}|${orderId}|${exp}|${tenantId}`;
    const expected = sign(input.secret, payload);
    if (safeEqualHex(expected, sig)) {
      return { ok: true, action, orderId, tenantId };
    }
  }
  return { ok: false, reason: "bad_sig" };
}

/**
 * Keyboard for new-order alerts (COD-friendly daily ops).
 * Pass `exclude` after an action succeeds so that button is dropped
 * without wiping the rest of the row.
 */
export function buildOrderActionKeyboard(input: {
  orderId: string;
  tenantId: string;
  secret: string;
  exclude?: TelegramOrderAction[];
}): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | null {
  const exclude = new Set(input.exclude ?? []);
  const specs: Array<{ action: TelegramOrderAction; text: string }> = [
    { action: "paid", text: "Mark paid" },
    { action: "ready", text: "Mark ready" },
    { action: "details", text: "Details" },
    { action: "cancel", text: "Cancel order" },
  ];

  const buttons: Array<{ text: string; callback_data: string }> = [];
  for (const spec of specs) {
    if (exclude.has(spec.action)) continue;
    const data = buildOrderActionCallbackData({
      action: spec.action,
      orderId: input.orderId,
      tenantId: input.tenantId,
      secret: input.secret,
    });
    if (!data) return null;
    buttons.push({ text: spec.text, callback_data: data });
  }

  if (buttons.length === 0) {
    return { inline_keyboard: [] };
  }

  // Pair into rows of two for a compact keyboard.
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  return { inline_keyboard: rows };
}
