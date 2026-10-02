import { headers } from "next/headers";
import { getOperatorDiscoveryCampaigns } from "@/lib/platform-api/superadmin/discovery";

export async function GET() {
  const requestHeaders = await headers();
  const result = await getOperatorDiscoveryCampaigns({
    cookieHeader: requestHeaders.get("cookie"),
    ...(process.env.PLATFORM_API_BASE_URL
      ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
      : {}),
  });
  return Response.json({ campaigns: result.campaigns }, { status: result.status });
}
