import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { updateAccountProfile } from "@/lib/platform-auth-account";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (name.length < 2) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const ctx = await getAccountAuthRequestContext(request);
  const result = await updateAccountProfile({
    ...ctx,
    name,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.message.toLowerCase().includes("origin")
            ? "auth_origin_rejected"
            : "profile_update_failed",
      },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true as const, name });
}
