import { ethiopianPhoneSchema } from "@ecs/contracts";
import { NextResponse } from "next/server";
import { getSafeAccountCompletionPath } from "@/lib/account-completion";
import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import {
  changeAccountEmail,
  getAccountIdentity,
  updateAccountProfile,
} from "@/lib/platform-auth-account";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    next?: unknown;
    phone?: unknown;
  } | null;
  const parsedPhone = ethiopianPhoneSchema.safeParse(body?.phone);
  if (!parsedPhone.success) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email && (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const ctx = await getAccountAuthRequestContext(request);
  const identity = await getAccountIdentity(ctx);
  if (!identity.ok) return NextResponse.json({ error: "auth_required" }, { status: 401 });
  if (identity.needsEmail && !email) {
    return NextResponse.json({ error: "missing_email" }, { status: 400 });
  }
  if (identity.needsEmail && email) {
    const origin = ctx.origin ?? new URL(request.url).origin;
    const emailResult = await changeAccountEmail({
      ...ctx,
      callbackURL: `${origin}/complete-account?next=${encodeURIComponent(getSafeAccountCompletionPath(typeof body?.next === "string" ? body.next : undefined))}`,
      newEmail: email,
    });
    if (!emailResult.ok) {
      return NextResponse.json({ error: "email_update_failed" }, { status: emailResult.status });
    }
  }

  const result = await updateAccountProfile({
    ...ctx,
    phone: parsedPhone.data,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 401 ? "auth_required" : "profile_update_failed" },
      { status: result.status },
    );
  }

  const nextPath = getSafeAccountCompletionPath(
    typeof body?.next === "string" ? body.next : undefined,
  );
  return NextResponse.json({
    emailVerificationRequired: identity.needsEmail,
    ok: true as const,
    redirectTo: nextPath,
  });
}
