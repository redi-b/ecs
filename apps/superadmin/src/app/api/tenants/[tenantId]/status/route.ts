import { headers } from "next/headers";

import { updateSuperadminTenantStatus } from "@/lib/platform-api/superadmin/operations";

export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    reason?: unknown;
    status?: unknown;
  };
  if (
    (body.status !== "active" && body.status !== "suspended") ||
    typeof body.reason !== "string" ||
    body.reason.trim().length < 10
  ) {
    return Response.json({ error: "status_and_reason_required" }, { status: 400 });
  }
  const requestHeaders = await headers();
  const result = await updateSuperadminTenantStatus({
    cookieHeader: requestHeaders.get("cookie"),
    reason: body.reason.trim(),
    status: body.status,
    tenantId,
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  });
  return Response.json(result.ok ? { ok: true } : { error: result.message }, {
    status: result.ok ? 200 : result.status,
  });
}
