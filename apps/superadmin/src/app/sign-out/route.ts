import { NextResponse } from "next/server";

import { getOperationsAuthCookieClears } from "@/lib/auth-cookies";
import { platformFetch } from "@/lib/platform-api/client";

export async function POST(request: Request) {
  await platformFetch("/api/auth/sign-out", {
    cookieHeader: request.headers.get("cookie"),
    contentType: "json",
    method: "POST",
    body: "{}",
  }).catch(() => null);

  const response = NextResponse.redirect(new URL("/sign-in", request.url), { status: 303 });
  for (const cookie of getOperationsAuthCookieClears()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
