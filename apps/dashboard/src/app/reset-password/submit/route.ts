import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { resetAccountPassword } from "@/lib/platform-auth-account";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    newPassword?: unknown;
    token?: unknown;
  } | null;
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }
  const result = await resetAccountPassword({
    ...(await getAccountAuthRequestContext(request)),
    newPassword,
    token,
  });
  if (!result.ok) {
    const message = result.message.toLowerCase();
    return NextResponse.json(
      { error: message.includes("token") ? "invalid_token" : "reset_failed" },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true as const });
}
