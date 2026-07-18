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
 * Row 1: money / prep · Row 2: details / cancel
 */
export function buildOrderActionKeyboard(input: {
  orderId: string;
  tenantId: string;
  secret: string;
}): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | null {
  const paid = buildOrderActionCallbackData({
    action: "paid",
    orderId: input.orderId,
    tenantId: input.tenantId,
    secret: input.secret,
  });
  const ready = buildOrderActionCallbackData({
    action: "ready",
    orderId: input.orderId,
    tenantId: input.tenantId,
    secret: input.secret,
  });
  const details = buildOrderActionCallbackData({
    action: "details",
    orderId: input.orderId,
    tenantId: input.tenantId,
    secret: input.secret,
  });
  const cancel = buildOrderActionCallbackData({
    action: "cancel",
    orderId: input.orderId,
    tenantId: input.tenantId,
    secret: input.secret,
  });
  if (!paid || !ready || !details || !cancel) return null;
  return {
    inline_keyboard: [
      [
        { text: "Mark paid", callback_data: paid },
        { text: "Mark ready", callback_data: ready },
      ],
      [
        { text: "Details", callback_data: details },
        { text: "Cancel order", callback_data: cancel },
      ],
    ],
  };
}
