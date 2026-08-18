import type { APIRoute } from "astro";
import { customerSessionClearCookie } from "../../../lib/session/customer-cookie.js";

export const POST: APIRoute = async () => new Response(null, {
  status: 303,
  headers: { Location: "/account", "Set-Cookie": customerSessionClearCookie() },
});
