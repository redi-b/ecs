import { NextResponse } from "next/server";

import { getSharedAuthCookie, getSharedAuthCookieClears } from "@/lib/auth-cookies";
import { requestWantsJson } from "@/lib/request-wants-json";

export async function POST(request: Request) {
  const wantsJson = requestWantsJson(request);
  const signOutResult = await signOutWithPlatformAuth({
    cookieHeader: request.headers.get("cookie"),
    forwardedHost: request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "",
    forwardedProto: request.headers.get("x-forwarded-proto") ?? "http",
  });
  const redirectTo = getRedirectUrl("/admin/sign-in", request).toString();

  const response = wantsJson
    ? NextResponse.json({ ok: true as const, redirectTo })
    : NextResponse.redirect(redirectTo, { status: 303 });

  for (const cookie of signOutResult.cookies) {
    response.headers.append("set-cookie", getSharedAuthCookie(cookie));
  }

  for (const cookie of getSharedAuthCookieClears()) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

function getRedirectUrl(path: string, request: Request) {
  return new URL(path, getRequestOrigin(request));
}

function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return new URL(request.url).origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  return `${forwardedProto}://${forwardedHost}`;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getSetCookieValues(headers: Headers) {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies = headersWithSetCookie.getSetCookie?.();

  if (cookies?.length) {
    return cookies;
  }

  const cookie = headers.get("set-cookie");

  return cookie ? [cookie] : [];
}

async function signOutWithPlatformAuth(input: {
  cookieHeader?: string | null | undefined;
  forwardedHost: string;
  forwardedProto: string;
}) {
  const baseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const headers = new Headers({
    origin: `${input.forwardedProto}://${input.forwardedHost}`,
    "x-forwarded-host": input.forwardedHost,
    "x-forwarded-proto": input.forwardedProto,
  });

  if (input.cookieHeader?.trim()) {
    headers.set("cookie", input.cookieHeader.trim());
  }

  const response = await fetch(new URL("/platform/auth/sign-out", normalizeBaseUrl(baseUrl)), {
    cache: "no-store",
    headers,
    method: "POST",
  }).catch(() => null);

  return {
    cookies: response ? getSetCookieValues(response.headers) : [],
  };
}
