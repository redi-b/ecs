import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { preflightAccountPasswordReset } from "@/lib/platform-auth-account";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token")?.trim();
  const ctx = await getAccountAuthRequestContext(request);
  const origin = ctx.requestHost
    ? `${ctx.requestProto || "http"}://${ctx.requestHost}`
    : requestUrl.origin;
  const callbackUrl = new URL("/admin/reset-password", origin);

  if (!token) {
    callbackUrl.searchParams.set("error", "INVALID_TOKEN");
    return NextResponse.redirect(callbackUrl);
  }

  const redirectUrl = await preflightAccountPasswordReset({
    ...ctx,
    callbackURL: callbackUrl.toString(),
    token,
  });
  if (!redirectUrl) {
    callbackUrl.searchParams.set("error", "INVALID_TOKEN");
    return NextResponse.redirect(callbackUrl);
  }
  return NextResponse.redirect(redirectUrl);
}
