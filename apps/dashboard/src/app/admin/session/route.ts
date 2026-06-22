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

  const authResponse = await fetch(getPlatformAuthUrl("/sign-in/email"), {
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      rememberMe: true,
    }),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: getRequestOrigin(request).toString().replace(/\/$/, ""),
      "x-forwarded-host":
        request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "",
      "x-forwarded-proto": request.headers.get("x-forwarded-proto") ?? "http",
    },
    method: "POST",
    redirect: "manual",
  });

  if (!authResponse.ok) {
    return redirectToSignIn(
      request,
      nextPath,
      authResponse.status === 401 ? "invalid_credentials" : "auth_unavailable",
    );
  }

  const response = NextResponse.redirect(getRedirectUrl(nextPath, request), { status: 303 });
  const setCookie = authResponse.headers.get("set-cookie");

  if (setCookie) {
    response.headers.append("set-cookie", setCookie);
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

function getPlatformAuthUrl(path: string) {
  const baseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";

  return new URL(`/platform/auth${path}`, normalizeBaseUrl(baseUrl));
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
  return value.endsWith("/") ? value : `${value}/`;
}
