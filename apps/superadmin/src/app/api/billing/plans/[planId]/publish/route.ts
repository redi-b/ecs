import { headers } from "next/headers";

import { forwardPlanCommand } from "@/lib/platform-api/superadmin/billing";

export async function POST(request: Request, context: { params: Promise<{ planId: string }> }) {
  const requestHeaders = await headers();
  const { planId } = await context.params;
  const result = await forwardPlanCommand({
    body: await request.json().catch(() => ({})),
    cookieHeader: requestHeaders.get("cookie"),
    method: "POST",
    path: `/platform/operator/billing/plans/${encodeURIComponent(planId)}/publish`,
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  });
  return Response.json(result.data, { status: result.status });
}
