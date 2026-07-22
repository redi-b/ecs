import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Telegram callback_data max length is 64 bytes.
 * Codes are single letters so several actions fit with Medusa order ids.
 */
export type TelegramOrderAction = "paid" | "ready" | "cancel" | "details";

/** Settlement method pick after Mark paid (multi-step). */
export type TelegramSettlementCode = "0" | "1" | "2" | "3" | "4";

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

/** 0 cash · 1 telebirr · 2 cbe_birr · 3 bank_transfer · 4 other */
export const TELEGRAM_SETTLEMENT_METHODS: Record<
  TelegramSettlementCode,
  "cash" | "telebirr" | "cbe_birr" | "bank_transfer" | "other"
> = {
  "0": "cash",
  "1": "telebirr",
  "2": "cbe_birr",
  "3": "bank_transfer",
  "4": "other",
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
  | { ok: true; kind: "action"; action: TelegramOrderAction; orderId: string; tenantId: string }
  | {
      ok: true;
      kind: "settlement";
      method: (typeof TELEGRAM_SETTLEMENT_METHODS)[TelegramSettlementCode];
      orderId: string;
      tenantId: string;
    }
  | { ok: false; reason: "invalid" | "expired" | "bad_sig" } {
  const parts = data.trim().split("|");
  if (parts.length !== 4) return { ok: false, reason: "invalid" };
  const [code, orderId, expRaw, sig] = parts;
  if (!code || !orderId || !expRaw || !sig) return { ok: false, reason: "invalid" };
  const exp = Number(expRaw);
  if (!Number.isFinite(exp)) return { ok: false, reason: "invalid" };
  if (exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };

  // Settlement pick: s0|orderId|exp|sig
  if (code.startsWith("s") && code.length === 2) {
    const methodCode = code[1] as TelegramSettlementCode;
    const method = TELEGRAM_SETTLEMENT_METHODS[methodCode];
    if (!method) return { ok: false, reason: "invalid" };
    for (const tenantId of input.tenantIds) {
      const payload = `${code}|${orderId}|${exp}|${tenantId}`;
      const expected = sign(input.secret, payload);
      if (safeEqualHex(expected, sig)) {
        return { ok: true, kind: "settlement", method, orderId, tenantId };
      }
    }
    return { ok: false, reason: "bad_sig" };
  }

  const action = CODE_ACTION[code];
  if (!action) return { ok: false, reason: "invalid" };

  for (const tenantId of input.tenantIds) {
    const payload = `${code}|${orderId}|${exp}|${tenantId}`;
    const expected = sign(input.secret, payload);
    if (safeEqualHex(expected, sig)) {
      return { ok: true, kind: "action", action, orderId, tenantId };
    }
  }
  return { ok: false, reason: "bad_sig" };
}

/** Method picker after Mark paid. */
export function buildSettlementMethodKeyboard(input: {
  orderId: string;
  tenantId: string;
  secret: string;
}): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } | null {
  const specs: Array<{ code: TelegramSettlementCode; text: string }> = [
    { code: "0", text: "Cash" },
    { code: "1", text: "Telebirr" },
    { code: "2", text: "CBE Birr" },
    { code: "3", text: "Bank transfer" },
    { code: "4", text: "Other" },
  ];
  const orderId = input.orderId.trim();
  if (!orderId || orderId.length > 40) return null;
  const exp = Math.floor(Date.now() / 1000) + DEFAULT_TTL_SEC;
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  let row: Array<{ text: string; callback_data: string }> = [];
  for (const spec of specs) {
    const code = `s${spec.code}`;
    const payload = `${code}|${orderId}|${exp}|${input.tenantId}`;
    const sig = sign(input.secret, payload);
    const data = `${code}|${orderId}|${exp}|${sig}`;
    if (Buffer.byteLength(data, "utf8") > 64) return null;
    row.push({ text: spec.text, callback_data: data });
    if (row.length === 2) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);
  return { inline_keyboard: rows };
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
