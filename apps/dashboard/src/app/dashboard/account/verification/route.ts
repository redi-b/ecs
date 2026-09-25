import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { getAccountIdentity, sendAccountVerificationEmail } from "@/lib/platform-auth-account";

export async function POST(request: Request) {
  const ctx = await getAccountAuthRequestContext(request);
  const identity = await getAccountIdentity(ctx);
  if (!identity.ok) {
    return NextResponse.json({ error: "identity_unavailable" }, { status: identity.status });
  }
  if (identity.emailVerified) return NextResponse.json({ ok: true as const, verified: true });
  const origin = ctx.origin ?? new URL(request.url).origin;
  const result = await sendAccountVerificationEmail({
    ...ctx,
    callbackURL: `${origin}/dashboard/settings?section=account&verified=1`,
    email: identity.email,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "verification_failed" }, { status: result.status });
  }
  return NextResponse.json({ ok: true as const, verified: false });
}
