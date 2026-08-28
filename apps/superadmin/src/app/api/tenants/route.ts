import { headers } from "next/headers";

import { listSuperadminTenants } from "@/lib/platform-api/superadmin/tenants";

export async function GET(request: Request) {
  const requestHeaders = await headers();
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim().slice(0, 100) ?? "";
  const limit = Math.min(50, Math.max(1, Number.parseInt(params.get("limit") ?? "8", 10) || 8));
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
  const result = await listSuperadminTenants({
    cookieHeader: requestHeaders.get("cookie"),
    limit,
    offset,
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
    query,
  }).catch(() => ({
    ok: false as const,
    message: "superadmin_unavailable",
    status: 503,
  }));

  return Response.json(result.ok ? result.data : { error: result.message }, {
    status: result.ok ? 200 : result.status,
  });
}
