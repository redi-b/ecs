import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { requestAccountPasswordReset } from "@/lib/platform-auth-account";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const ctx = await getAccountAuthRequestContext(request);
  const origin = ctx.origin ?? new URL(request.url).origin;
  const result = await requestAccountPasswordReset({
    ...ctx,
    email,
    redirectTo: `${origin}/reset-password`,
  });
  // Do not reveal whether an account exists. Provider/network failure is the
  // only actionable distinction and remains generic to the user.
  if (!result.ok) {
    return NextResponse.json({ error: "request_failed" }, { status: result.status });
  }
  return NextResponse.json({ ok: true as const });
}
