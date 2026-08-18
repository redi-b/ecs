import type { APIRoute } from "astro";
import { customerSessionClearCookie } from "../../../lib/session/customer-cookie.js";
import { appendSetCookies, cartIdClearCookie } from "../../../lib/session/cart-cookie.js";

export const POST: APIRoute = async () => {
  const headers = new Headers({ Location: "/account" });
  appendSetCookies(headers, [customerSessionClearCookie(), cartIdClearCookie()]);
  return new Response(null, { status: 303, headers });
};
