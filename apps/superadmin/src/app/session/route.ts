import { NextResponse } from "next/server";

import { getOperationsAuthCookie, getPlatformAuthCookieHeader } from "@/lib/auth-cookies";
import { createPlatformUrl } from "@/lib/platform-api/client";
import { getSafeReturnTo } from "@/lib/safe-return-to";

export async function POST(request: Request) {
  const enhanced = request.headers.get("accept")?.includes("application/json") ?? false;
  const form = await request.formData();
  const intent = form.get("intent");
  const isReauthentication = intent === "reauthenticate";
  const returnTo = getSafeReturnTo(form.get("returnTo"), request.url);
  let email = form.get("email");
  const password = form.get("password");

  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  if (isReauthentication) {
    const currentSession = await fetch(createPlatformUrl("/platform/me"), {
      cache: "no-store",
      headers: {
        accept: "application/json",
        cookie: getPlatformAuthCookieHeader(request.headers.get("cookie")),
        origin: `${forwardedProto}://${forwardedHost}`,
        "x-forwarded-host": forwardedHost,
        "x-forwarded-proto": forwardedProto,
      },
    }).catch(() => null);
    const body = (await currentSession?.json().catch(() => null)) as {
      user?: { email?: unknown };
    } | null;
    const currentEmail = body?.user?.email;
    if (!currentSession?.ok || typeof currentEmail !== "string" || !currentEmail.trim()) {
      if (enhanced) {
        return NextResponse.json({ error: "session_expired" }, { status: 401 });
      }
      return redirectWithError(request, "session_expired", { returnTo });
    }
    email = currentEmail;
  }

  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    if (enhanced) return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
    return redirectWithError(request, "invalid_credentials", {
      reauthentication: isReauthentication,
      returnTo,
    });
  }

  const response = await fetch(createPlatformUrl("/platform/auth/sign-in/email"), {
    method: "POST",
    cache: "no-store",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: `${forwardedProto}://${forwardedHost}`,
      "x-forwarded-host": forwardedHost,
      "x-forwarded-proto": forwardedProto,
    },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  }).catch((error: unknown) => {
    console.error("Operations sign-in could not reach Platform.", error);
    return null;
  });

  if (!response?.ok) {
    console.error("Operations sign-in was rejected by Platform.", {
      status: response?.status ?? "unreachable",
    });
    const error = response?.status === 401 ? "invalid_credentials" : "unavailable";
    if (enhanced) {
      return NextResponse.json({ error }, { status: response?.status === 401 ? 401 : 503 });
    }
    return redirectWithError(request, error, {
      reauthentication: isReauthentication,
      returnTo,
    });
  }

  const platformCookieHeader = getCookieHeader(response.headers.getSetCookie());
  const operatorSession = platformCookieHeader
    ? await fetch(createPlatformUrl("/platform/operator/session"), {
        cache: "no-store",
        headers: {
          accept: "application/json",
          cookie: platformCookieHeader,
        },
      }).catch(() => null)
    : null;

  if (!operatorSession?.ok) {
    if (platformCookieHeader) {
      await fetch(createPlatformUrl("/platform/auth/sign-out"), {
        cache: "no-store",
        headers: { cookie: platformCookieHeader },
        method: "POST",
      }).catch(() => null);
    }
    if (enhanced) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
    return redirectWithError(request, "invalid_credentials", {
      reauthentication: isReauthentication,
      returnTo,
    });
  }

  const redirectResponse = enhanced
    ? NextResponse.json({ ok: true, returnTo })
    : NextResponse.redirect(new URL(returnTo, request.url), { status: 303 });
  for (const cookie of response.headers.getSetCookie()) {
    redirectResponse.headers.append("set-cookie", getOperationsAuthCookie(cookie));
  }
  return redirectResponse;
}

function getCookieHeader(setCookies: string[]) {
  return setCookies
    .map((cookie) => cookie.split(";", 1)[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function redirectWithError(
  request: Request,
  error: string,
  options: { reauthentication?: boolean; returnTo?: string } = {},
) {
  const url = new URL(options.reauthentication ? "/reauthenticate" : "/sign-in", request.url);
  url.searchParams.set("error", error);
  if (options.returnTo && options.returnTo !== "/") {
    url.searchParams.set("returnTo", options.returnTo);
  }
  return NextResponse.redirect(url, { status: 303 });
}
