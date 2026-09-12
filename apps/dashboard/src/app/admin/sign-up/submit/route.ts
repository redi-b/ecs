import { NextResponse } from "next/server";

import { getSharedAuthCookie } from "@/lib/auth-cookies";
import { requestWantsJson } from "@/lib/request-wants-json";

type SignUpResult =
  | {
      ok: true;
      cookies: string[];
    }
  | {
      ok: false;
      error: string;
    };

export async function POST(request: Request) {
  const wantsJson = requestWantsJson(request);
  const payload = await readSignUpPayload(request);
  const ownerName = payload.ownerName;
  const email = payload.email?.toLowerCase() ?? null;
  const password = payload.password;
  const confirmPassword = payload.confirmPassword;
  const nextPath = getSafeNextPath(payload.next);

  if (!ownerName || !email || !password || !confirmPassword) {
    return failSignUp(request, "missing_required_fields", payload, wantsJson);
  }

  if (password.length < 8) {
    return failSignUp(request, "password_too_short", payload, wantsJson);
  }

  if (password !== confirmPassword) {
    return failSignUp(request, "password_mismatch", payload, wantsJson);
  }

  const signUpResult = await signUpWithPlatformAuth({
    callbackURL: new URL(
      `/admin/sign-in?verified=1&next=${encodeURIComponent(nextPath)}`,
      getRequestOrigin(request),
    ).toString(),
    email,
    forwardedHost: getForwardedHost(request),
    forwardedProto: getForwardedProto(request),
    name: ownerName,
    password,
  });

  if (!signUpResult.ok) {
    return failSignUp(request, signUpResult.error, payload, wantsJson);
  }

  if (signUpResult.cookies.length === 0) {
    if (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true") {
      const redirectTo = new URL("/admin/sign-up/check-email", getRequestOrigin(request));
      redirectTo.searchParams.set("email", email);
      return wantsJson
        ? NextResponse.json({ ok: true as const, redirectTo: redirectTo.toString() })
        : NextResponse.redirect(redirectTo, { status: 303 });
    }
    return failSignUp(request, "auth_session_missing", payload, wantsJson);
  }

  const redirectTo = new URL(nextPath, getRequestOrigin(request)).toString();

  if (wantsJson) {
    const response = NextResponse.json({ ok: true as const, redirectTo });
    for (const cookie of signUpResult.cookies) {
      response.headers.append("set-cookie", getSharedAuthCookie(cookie));
    }
    return response;
  }

  const response = NextResponse.redirect(redirectTo, { status: 303 });
  for (const cookie of signUpResult.cookies) {
    response.headers.append("set-cookie", getSharedAuthCookie(cookie));
  }
  return response;
}

async function readSignUpPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      ownerName?: unknown;
      password?: unknown;
      confirmPassword?: unknown;
      next?: unknown;
    } | null;
    return {
      email: typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null,
      ownerName:
        typeof body?.ownerName === "string" && body.ownerName.trim() ? body.ownerName.trim() : null,
      password: typeof body?.password === "string" && body.password ? body.password : null,
      next: typeof body?.next === "string" ? body.next : null,
      confirmPassword:
        typeof body?.confirmPassword === "string" && body.confirmPassword
          ? body.confirmPassword
          : null,
    };
  }

  const formData = await request.formData();
  return {
    email: getRequiredString(formData, "email"),
    ownerName: getRequiredString(formData, "ownerName"),
    password: getRequiredString(formData, "password"),
    confirmPassword: getRequiredString(formData, "confirmPassword"),
    next: getRequiredString(formData, "next"),
  };
}

function failSignUp(
  request: Request,
  error: string,
  payload: { email: string | null; next?: string | null; ownerName: string | null },
  wantsJson: boolean,
) {
  if (wantsJson) {
    const status =
      error === "email_already_exists"
        ? 409
        : error === "password_too_short" ||
            error === "password_mismatch" ||
            error === "missing_required_fields"
          ? 400
          : 503;
    return NextResponse.json({ error, ok: false as const }, { status });
  }
  return redirectToSignUp(request, error, payload);
}

async function signUpWithPlatformAuth(input: {
  callbackURL: string;
  email: string;
  forwardedHost: string;
  forwardedProto: string;
  name: string;
  password: string;
}): Promise<SignUpResult> {
  const response = await fetch(new URL("/platform/auth/sign-up/email", getPlatformBaseUrl()), {
    body: JSON.stringify({
      email: input.email,
      callbackURL: input.callbackURL,
      name: input.name,
      password: input.password,
    }),
    cache: "no-store",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: `${input.forwardedProto}://${input.forwardedHost}`,
      "x-forwarded-host": input.forwardedHost,
      "x-forwarded-proto": input.forwardedProto,
    },
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      error: "auth_unavailable",
    };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
      error?: string;
      message?: string;
    };

    return {
      ok: false,
      error: normalizeSignupError(body.error ?? body.code ?? body.message),
    };
  }

  return {
    ok: true,
    cookies: getSetCookieValues(response.headers),
  };
}

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSignupError(value: string | undefined) {
  if (!value) {
    return "signup_failed";
  }

  const code = value.trim().toUpperCase();

  if (
    code === "USER_ALREADY_EXISTS" ||
    code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
    code.includes("ALREADY_EXISTS")
  ) {
    return "email_already_exists";
  }

  return "signup_failed";
}

function getSafeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/admin/onboarding";
}

function redirectToSignUp(
  request: Request,
  error: string,
  payload: { email: string | null; next?: string | null; ownerName: string | null },
) {
  const url = new URL("/admin/sign-up", getRequestOrigin(request));

  url.searchParams.set("error", error);
  if (payload.ownerName) url.searchParams.set("ownerName", payload.ownerName);
  if (payload.email) url.searchParams.set("email", payload.email);
  if (payload.next) url.searchParams.set("next", getSafeNextPath(payload.next));

  return NextResponse.redirect(url, { status: 303 });
}

function getPlatformBaseUrl() {
  return normalizeBaseUrl(process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000");
}

function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return new URL(request.url).origin;
  }

  return `${getForwardedProto(request)}://${forwardedHost}`;
}

function getForwardedHost(request: Request) {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
}

function getForwardedProto(request: Request) {
  return request.headers.get("x-forwarded-proto") ?? "http";
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
