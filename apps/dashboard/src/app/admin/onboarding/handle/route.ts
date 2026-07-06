import { NextResponse } from "next/server";

import { checkTenantHandleAvailability } from "@/lib/platform-onboarding";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle") ?? "";
  const result = await checkTenantHandleAvailability({
    handle,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.message,
      },
      {
        status: result.status,
      },
    );
  }

  return NextResponse.json(result.availability);
}
