import { createAuthClient } from "better-auth/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const nextPath = getSafeNextPath(formData.get("next"));

  if (typeof email !== "string" || !email.trim()) {
    return redirectToSignIn(request, nextPath, "missing_email");
  }

  if (typeof password !== "string" || !password) {
    return redirectToSignIn(request, nextPath, "missing_password");
  }

  const authResult = await signInWithPlatformAuth({
    email: email.trim().toLowerCase(),
    forwardedHost: request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "",
    forwardedProto: request.headers.get("x-forwarded-proto") ?? "http",
    password,
  });

  if (!authResult.ok) {
    return redirectToSignIn(
      request,
      nextPath,
      authResult.status === 401 ? "invalid_credentials" : "auth_unavailable",
    );
  }

  const response = NextResponse.redirect(getRedirectUrl(nextPath, request), { status: 303 });

  for (const cookie of authResult.cookies) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

function getSafeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }

  return value;
}

function redirectToSignIn(request: Request, nextPath: string, error: string) {
  const url = getRedirectUrl("/admin/sign-in", request);

  url.searchParams.set("error", error);
  url.searchParams.set("next", nextPath);

  return NextResponse.redirect(url, { status: 303 });
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

async function signInWithPlatformAuth(input: {
  email: string;
  forwardedHost: string;
  forwardedProto: string;
  password: string;
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
