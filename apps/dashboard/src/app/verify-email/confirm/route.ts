import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { getSharedAuthCookie } from "@/lib/auth-cookies";
import { getSafeAccountReturnPath, verifyAccountEmail } from "@/lib/platform-auth-account";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const ctx = await getAccountAuthRequestContext(request);
  const origin = ctx.requestHost
    ? `${ctx.requestProto || "http"}://${ctx.requestHost}`
    : requestUrl.origin;
  const resultUrl = new URL("/verify-email/result", origin);
  const formData = await request.formData();
  const token = getFormValue(formData, "token");
  const intent =
    getFormValue(formData, "intent") === "approve-email-change"
      ? "approve-email-change"
      : "verify-email";
  const returnTo = getSafeAccountReturnPath(getFormValue(formData, "returnTo"));
  resultUrl.searchParams.set("intent", intent);
  resultUrl.searchParams.set("returnTo", returnTo);

  const submittedOrigin = request.headers.get("origin");
  if (
    !token ||
    token.length > 4096 ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (submittedOrigin !== null && submittedOrigin !== origin)
  ) {
    resultUrl.searchParams.set("error", "INVALID_TOKEN");
    return NextResponse.redirect(resultUrl, 303);
  }

  const result = await verifyAccountEmail({
    ...ctx,
    callbackURL: resultUrl.toString(),
    token,
  });
  if (!result) {
    resultUrl.searchParams.set("error", "VERIFICATION_UNAVAILABLE");
    return NextResponse.redirect(resultUrl, 303);
  }

  const response = NextResponse.redirect(result.redirectUrl, 303);
  for (const cookie of result.cookies) {
    response.headers.append("set-cookie", getSharedAuthCookie(cookie));
  }
  return response;
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
