import { NextResponse } from "next/server";

import { getSharedAuthCookie } from "@/lib/auth-cookies";
import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { changeAccountPassword } from "@/lib/platform-auth-account";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown;
    newPassword?: unknown;
    revokeOtherSessions?: unknown;
  } | null;

  const currentPassword =
    typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const revokeOtherSessions = body?.revokeOtherSessions !== false;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }

  const ctx = await getAccountAuthRequestContext(request);
  const result = await changeAccountPassword({
    ...ctx,
    currentPassword,
    newPassword,
    revokeOtherSessions,
  });

  if (!result.ok) {
    const message = result.message.toLowerCase();
    const error =
      result.status === 401 || message.includes("password") || message.includes("credential")
        ? "invalid_current_password"
        : message.includes("origin")
          ? "auth_origin_rejected"
          : "password_change_failed";
    return NextResponse.json({ error }, { status: result.status === 403 ? 403 : 400 });
  }

  const response = NextResponse.json({ ok: true as const });
  for (const cookie of result.cookies) {
    response.headers.append("set-cookie", getSharedAuthCookie(cookie));
  }
  return response;
}
