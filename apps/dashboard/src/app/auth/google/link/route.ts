import { NextResponse } from "next/server";
import { getSharedAuthCookie } from "@/lib/auth-cookies";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { validateShopHost } from "@/lib/shop-host";

export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const protocol =
    request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.slice(0, -1);
  const origin = `${protocol}://${host}`;
  const settingsUrl = new URL("/dashboard/settings?section=account", origin);
  settingsUrl.searchParams.set("connection", "google-linked");
  const trustedDashboardHost =
    isCentralDashboardHost(host) || (await validateShopHost({ forwardedHost: host })).ok;
  if (!trustedDashboardHost || !process.env.GOOGLE_CLIENT_ID?.trim()) {
    settingsUrl.searchParams.set("connection", "google-unavailable");
    return NextResponse.redirect(settingsUrl, { status: 303 });
  }
  const platformBaseUrl = (process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const response = await fetch(`${platformBaseUrl}/platform/auth/link-social`, {
    body: JSON.stringify({ callbackURL: settingsUrl.toString(), provider: "google" }),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
      origin,
      "x-forwarded-host": host,
      "x-forwarded-proto": protocol,
    },
    method: "POST",
    redirect: "manual",
  }).catch(() => null);
  const body = (await response?.json().catch(() => null)) as { url?: unknown } | null;
  const authorizationUrl =
    typeof body?.url === "string" ? body.url : response?.headers.get("location");
  if (!response?.ok || !authorizationUrl) {
    settingsUrl.searchParams.set("connection", "google-failed");
    return NextResponse.redirect(settingsUrl, { status: 303 });
  }
  const next = NextResponse.redirect(authorizationUrl, { status: 303 });
  for (const cookie of getSetCookieValues(response.headers))
    next.headers.append("set-cookie", getSharedAuthCookie(cookie));
  return next;
}

function getSetCookieValues(headers: Headers) {
  const values = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (values?.length) return values;
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}
