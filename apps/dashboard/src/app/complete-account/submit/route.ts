import { ethiopianPhoneSchema } from "@ecs/contracts";
import { NextResponse } from "next/server";
import { getSafeAccountCompletionPath } from "@/lib/account-completion";
import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { updateAccountProfile } from "@/lib/platform-auth-account";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    next?: unknown;
    phone?: unknown;
  } | null;
  const parsedPhone = ethiopianPhoneSchema.safeParse(body?.phone);
  if (!parsedPhone.success) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const result = await updateAccountProfile({
    ...(await getAccountAuthRequestContext(request)),
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
  return NextResponse.json({ ok: true as const, redirectTo: nextPath });
}
