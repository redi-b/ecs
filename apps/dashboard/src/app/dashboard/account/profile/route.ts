import { ethiopianPhoneSchema, profileAvatarSchema } from "@ecs/contracts";
import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { getAccountIdentity, updateAccountProfile } from "@/lib/platform-auth-account";

export async function GET(request: Request) {
  const result = await getAccountIdentity(await getAccountAuthRequestContext(request));
  if (!result.ok) {
    return NextResponse.json({ error: "profile_unavailable" }, { status: result.status });
  }
  return NextResponse.json({
    calendarPreference: result.calendarPreference,
    name: result.name,
    phone: result.phone,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    avatar?: unknown;
    phone?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const phone = ethiopianPhoneSchema.safeParse(body?.phone);
  if (!phone.success) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const avatar =
    body?.avatar === undefined ? undefined : profileAvatarSchema.safeParse(body.avatar);
  if (avatar && !avatar.success) {
    return NextResponse.json({ error: "invalid_avatar" }, { status: 400 });
  }

  const result = await updateAccountProfile({
    ...(await getAccountAuthRequestContext(request)),
    name,
    phone: phone.data,
    ...(avatar?.success ? { avatarPreferences: JSON.stringify(avatar.data) } : {}),
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.message.toLowerCase().includes("origin")
          ? "auth_origin_rejected"
          : "profile_update_failed",
      },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true as const, name, phone: phone.data });
}
