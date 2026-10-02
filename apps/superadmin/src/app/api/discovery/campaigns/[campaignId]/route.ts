import { headers } from "next/headers";
import { updateOperatorDiscoveryCampaign } from "@/lib/platform-api/superadmin/discovery";

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const requestHeaders = await headers();
  const params = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = typeof body.reason === "string" ? body.reason : "";
  const patch = body.patch && typeof body.patch === "object" ? body.patch : {};
  const result = await updateOperatorDiscoveryCampaign({
    campaignId: params.campaignId,
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
    patch: patch as Record<string, unknown>,
    reason,
  });
  return Response.json(result.data, { status: result.status });
}
