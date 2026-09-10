import type { APIRoute } from "astro";
import { getPlatformApiBaseUrl, getRequestHost } from "../../lib/env.js";

export const POST: APIRoute = async ({ request }) => {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return Response.json({ error: "invalid_event" }, { status: 400 });
  }

  const requestHost = getRequestHost(request);
  const response = await fetch(`${getPlatformApiBaseUrl()}/store/analytics/events`, {
    body: JSON.stringify(payload),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(requestHost ? { "x-forwarded-host": requestHost } : {}),
      ...(request.headers.get("user-agent")
        ? { "user-agent": request.headers.get("user-agent") as string }
        : {}),
      ...(request.headers.get("x-forwarded-for")
        ? { "x-forwarded-for": request.headers.get("x-forwarded-for") as string }
        : {}),
      ...(request.headers.get("x-real-ip")
        ? { "x-real-ip": request.headers.get("x-real-ip") as string }
        : {}),
    },
    method: "POST",
  }).catch(() => null);

  if (!response?.ok) return new Response(null, { status: response?.status ?? 503 });
  return new Response(null, { status: 202 });
};
