import { userCalendarPreferenceSchema } from "@ecs/contracts";
import { NextResponse } from "next/server";

import { getAccountAuthRequestContext } from "@/lib/account-request-context";
import { updateAccountProfile } from "@/lib/platform-auth-account";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    calendarPreference?: unknown;
  } | null;
  const preference = userCalendarPreferenceSchema.safeParse(body?.calendarPreference);
  if (!preference.success) {
    return NextResponse.json({ error: "invalid_calendar_preference" }, { status: 400 });
  }

  const result = await updateAccountProfile({
    ...(await getAccountAuthRequestContext(request)),
    calendarPreference: preference.data,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.message.toLowerCase().includes("origin")
          ? "auth_origin_rejected"
          : "calendar_preference_update_failed",
      },
      { status: result.status },
    );
  }
  return NextResponse.json({ calendarPreference: preference.data, ok: true as const });
}
