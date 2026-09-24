import type { StoreCart } from "./types.js";

export function cartJson(cart: StoreCart, init?: ResponseInit) {
  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "private, no-store");
  return new Response(JSON.stringify({ ok: true, cart, count }), { ...init, status: init?.status ?? 200, headers });
}

export function cartJsonError(message: string, status = 400) {
  return Response.json({ ok: false, message }, { status, headers: { "Cache-Control": "private, no-store" } });
}
