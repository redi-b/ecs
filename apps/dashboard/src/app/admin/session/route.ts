import { createAuthClient } from "better-auth/client";
import { NextResponse } from "next/server";

import { getSharedAuthCookie } from "@/lib/auth-cookies";
import { isCentralDashboardHost } from "@/lib/dashboard-hosts";
import { requestWantsJson } from "@/lib/request-wants-json";
import {
  sessionCanAccessShopHost,
  validateShopHost,
} from "@/lib/shop-host";

export async function POST(request: Request) {
  const wantsJson = requestWantsJson(request);
  const payload = await readSignInPayload(request);
  const email = payload.email;
  const password = payload.password;
  const nextPath = getSafeNextPath(payload.next);

  if (typeof email !== "string" || !email.trim()) {
    return failSignIn(request, nextPath, "missing_email", wantsJson);
  }

  if (typeof password !== "string" || !password) {
    return failSignIn(request, nextPath, "missing_password", wantsJson);
  }

  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";
  const hostResult = await validateShopHost({ forwardedHost });

  if (!hostResult.ok) {
    return failSignIn(request, nextPath, hostResult.error, wantsJson);
  }

  const authResult = await signInWithPlatformAuth({
    clientIp: getRequestClientIp(request),
    email: email.trim().toLowerCase(),
    forwardedHost,
    forwardedProto,
    password,
    userAgent: request.headers.get("user-agent"),
  });

  if (!authResult.ok) {
    return failSignIn(
      request,
      nextPath,
      authResult.status === 401 ? "invalid_credentials" : "auth_unavailable",
      wantsJson,
    );
  }

  // Shop hosts: credentials alone are not enough — user must be a member of *this* shop.
  // Do not set session cookies if membership fails (avoids "signed in but forbidden" limbo).
  if (!isCentralDashboardHost(forwardedHost)) {
    const cookieHeader = getCookieHeader(authResult.cookies);
    const allowed = await sessionCanAccessShopHost({
      cookieHeader,
      forwardedHost,
    });

    if (!allowed) {
      return failSignIn(request, nextPath, "shop_access_denied", wantsJson);
    }
  }

  const redirectPath = await getPostSignInRedirectPath({
    cookies: authResult.cookies,
    forwardedHost,
    nextPath,
  });
  const redirectTo = absoluteRedirectUrl(redirectPath, request);

  if (wantsJson) {
    const response = NextResponse.json({ ok: true as const, redirectTo });
    for (const cookie of authResult.cookies) {
      response.headers.append("set-cookie", getSharedAuthCookie(cookie));
    }
    return response;
  }

  const response = NextResponse.redirect(redirectTo, { status: 303 });
  for (const cookie of authResult.cookies) {
    response.headers.append("set-cookie", getSharedAuthCookie(cookie));
  }
  return response;
}

async function readSignInPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      next?: unknown;
      password?: unknown;
    } | null;
    return {
      email: typeof body?.email === "string" ? body.email : null,
      next: typeof body?.next === "string" ? body.next : null,
      password: typeof body?.password === "string" ? body.password : null,
    };
  }

  const formData = await request.formData();
  return {
    email: formData.get("email"),
    next: formData.get("next"),
    password: formData.get("password"),
  };
}

function failSignIn(request: Request, nextPath: string, error: string, wantsJson: boolean) {
  if (wantsJson) {
    const status =
      error === "invalid_credentials" ||
      error === "missing_email" ||
      error === "missing_password" ||
      error === "shop_access_denied"
        ? 401
        : error === "shop_not_found" || error === "shop_unavailable"
          ? 404
          : 503;
    return NextResponse.json({ error, ok: false as const }, { status });
  }
  return redirectToSignIn(request, nextPath, error);
}

async function getPostSignInRedirectPath(input: {
  cookies: string[];
  forwardedHost: string;
  nextPath: string;
}) {
  if (!isCentralDashboardHost(input.forwardedHost) || input.nextPath !== "/admin") {
    return input.nextPath;
  }

  const cookieHeader = getCookieHeader(input.cookies);

  if (!cookieHeader) {
    return "/admin/onboarding";
  }

  const response = await fetch(new URL("/platform/onboarding/state", getPlatformBaseUrl()), {
    cache: "no-store",
    headers: {
      accept: "application/json",
      cookie: cookieHeader,
    },
  }).catch(() => null);

  if (!response?.ok) {
    return "/admin/onboarding";
  }

  const body = (await response.json().catch(() => ({}))) as {
    primaryTenant?: {
      dashboardUrl?: string;
    } | null;
  };

  return body.primaryTenant?.dashboardUrl ?? "/admin/onboarding";
}

function getSafeNextPath(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  return value;
}

function redirectToSignIn(request: Request, nextPath: string, error: string) {
  const url = getRedirectUrl("/admin/sign-in", request);

  url.searchParams.set("error", error);
  if (nextPath.startsWith("/")) {
    url.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(url, { status: 303 });
}

function absoluteRedirectUrl(pathOrUrl: string, request: Request) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  return getRedirectUrl(pathOrUrl, request).toString();
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

function getCookieHeader(cookies: string[]) {
  return cookies
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function getRequestClientIp(request: Request) {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("true-client-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    request.headers.get("x-client-ip"),
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

async function signInWithPlatformAuth(input: {
  clientIp?: string | null | undefined;
  email: string;
  forwardedHost: string;
  forwardedProto: string;
  password: string;
  userAgent?: string | null | undefined;
}) {
  const baseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const client = createAuthClient({
    basePath: "/platform/auth",
    baseURL: normalizeBaseUrl(baseUrl),
  });
  const cookies: string[] = [];
  const result = await client.signIn.email(
    {
      email: input.email,
      password: input.password,
      rememberMe: true,
    },
    {
      headers: {
        origin: `${input.forwardedProto}://${input.forwardedHost}`,
        "x-forwarded-host": input.forwardedHost,
        "x-forwarded-proto": input.forwardedProto,
        // Capture the browser identity on the session (not the dashboard server).
        ...(input.clientIp
          ? {
              "x-forwarded-for": input.clientIp,
              "x-real-ip": input.clientIp,
            }
          : {}),
        ...(input.userAgent ? { "user-agent": input.userAgent } : {}),
      },
      onResponse: (context) => {
        cookies.push(...getSetCookieValues(context.response.headers));
      },
      redirect: "manual",
    },
  );

  if (result.error) {
    return {
      ok: false,
      status: result.error.status === 401 ? 401 : 503,
    } as const;
  }

  return {
    cookies,
    ok: true,
  } as const;
}
