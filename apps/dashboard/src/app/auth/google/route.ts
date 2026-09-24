import { NextResponse } from "next/server";

import { getSharedAuthCookie } from "@/lib/auth-cookies";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";

export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const protocol =
    request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.slice(0, -1);
  const origin = `${protocol}://${host}`;
  const nextPath = getSafeNextPath(new URL(request.url).searchParams.get("next"));
  const signInUrl = new URL("/sign-in", origin);
  signInUrl.searchParams.set("next", nextPath);

  if (!isCentralDashboardHost(host) || !process.env.GOOGLE_CLIENT_ID?.trim()) {
    signInUrl.searchParams.set("error", "social_sign_in_unavailable");
    return NextResponse.redirect(signInUrl, { status: 303 });
  }

  const callbackUrl = new URL("/sign-in", origin);
  callbackUrl.searchParams.set("next", nextPath);
  const errorCallbackUrl = new URL(callbackUrl);
  errorCallbackUrl.searchParams.set("error", "social_sign_in_failed");

  const platformBaseUrl = (process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const authResponse = await fetch(`${platformBaseUrl}/platform/auth/sign-in/social`, {
    body: JSON.stringify({
      callbackURL: callbackUrl.toString(),
      errorCallbackURL: errorCallbackUrl.toString(),
      provider: "google",
    }),
    cache: "no-store",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin,
      "x-forwarded-host": host,
      "x-forwarded-proto": protocol,
    },
    method: "POST",
    redirect: "manual",
  }).catch(() => null);

  const body = (await authResponse?.json().catch(() => null)) as { url?: unknown } | null;
  const authorizationUrl =
    typeof body?.url === "string" ? body.url : authResponse?.headers.get("location");
  if (!authResponse?.ok || !authorizationUrl) {
    signInUrl.searchParams.set("error", "social_sign_in_unavailable");
    return NextResponse.redirect(signInUrl, { status: 303 });
  }

  const response = NextResponse.redirect(authorizationUrl, { status: 303 });
  for (const cookie of getSetCookieValues(authResponse.headers)) {
    response.headers.append("set-cookie", getSharedAuthCookie(cookie));
  }
  return response;
}

function getSafeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function getSetCookieValues(headers: Headers) {
  const values = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (values?.length) return values;
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}
