import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { sendAccountVerificationEmail } from "@/lib/platform-auth-account";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const ctx = await getAccountAuthRequestContext(request);
  const origin = ctx.origin ?? new URL(request.url).origin;
  const result = await sendAccountVerificationEmail({
    ...ctx,
    callbackURL: `${origin}/admin/sign-in?verified=1`,
    email,
  });

  // Keep the response generic so this endpoint cannot be used to discover accounts.
  if (!result.ok && result.status >= 500) {
    return NextResponse.json({ error: "verification_unavailable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true as const });
}
