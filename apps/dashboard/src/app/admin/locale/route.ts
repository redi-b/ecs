import { type NextRequest, NextResponse } from "next/server";

import { isAppLocale, localeCookieName } from "@/i18n/config";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const value = contentType.includes("application/json")
    ? ((await request.json().catch(() => null)) as { locale?: unknown } | null)?.locale
    : (await request.formData()).get("locale");

  if (!isAppLocale(value)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  const response = NextResponse.json({ locale: value });
  response.cookies.set(localeCookieName, value, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
