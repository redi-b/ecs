import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { changeAccountEmail, getAccountIdentity } from "@/lib/platform-auth-account";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const identity = await getAccountIdentity(await getAccountAuthRequestContext(request));
  if (!identity.ok) {
    return NextResponse.json({ error: "identity_unavailable" }, { status: identity.status });
  }
  return NextResponse.json({
    email: identity.email,
    emailVerified: identity.emailVerified,
    ok: true as const,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { newEmail?: unknown } | null;
  const newEmail = typeof body?.newEmail === "string" ? body.newEmail.trim() : "";
  if (!EMAIL_PATTERN.test(newEmail) || newEmail.length > 320) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const ctx = await getAccountAuthRequestContext(request);
  const origin = ctx.origin ?? new URL(request.url).origin;
  const result = await changeAccountEmail({
    ...ctx,
    callbackURL: `${origin}/dashboard/settings?section=account&emailChanged=1`,
    newEmail,
  });
  if (!result.ok) {
    const message = result.message.toLowerCase();
    const error = message.includes("same")
      ? "email_unchanged"
      : message.includes("origin")
        ? "auth_origin_rejected"
        : "email_change_failed";
    return NextResponse.json({ error }, { status: result.status });
  }
  return NextResponse.json({ ok: true as const });
}
