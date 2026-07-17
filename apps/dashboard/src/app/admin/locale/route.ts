import { type NextRequest, NextResponse } from "next/server";

import { isAppLocale, localeCookieName } from "@/i18n/config";
import { getSharedParentCookieDomain } from "@/lib/shared-cookie-domain";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const value = contentType.includes("application/json")
    ? ((await request.json().catch(() => null)) as { locale?: unknown } | null)?.locale
    : (await request.formData()).get("locale");

  if (!isAppLocale(value)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  const response = NextResponse.json({ locale: value });
  const domain = getSharedParentCookieDomain({
    hostname: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  });

  response.cookies.set(localeCookieName, value, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(domain ? { domain } : {}),
    path: "/",
  });

  return response;
}
