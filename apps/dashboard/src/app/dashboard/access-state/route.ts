import { NextResponse } from "next/server";

import { getMerchantDashboardAccessShell } from "@/lib/merchant-dashboard";

export async function GET(request: Request) {
  const access = await getMerchantDashboardAccessShell({
    cookieHeader: request.headers.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  });

  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  return NextResponse.json({ permissions: access.access.permissions ?? [] });
}
