import { insightsProductsQuerySchema } from "@ecs/contracts";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getInsightsProducts } from "@/lib/insights-sales";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = insightsProductsQuerySchema.safeParse({
    from: params.from, to: params.to, comparison: "none", productId: params.productId,
    page: params.page ?? 1, q: params.q ?? "", sort: "units",
  });
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const requestHeaders = await headers();
  const result = await getInsightsProducts({
    cookieHeader: requestHeaders.get("cookie"), requestHost: requestHeaders.get("host"),
    tenantId: getSelectedTenantId(params), query: parsed.data,
  });
  if (!result.ok) return NextResponse.json({ error: "unavailable" }, { status: result.status });
  return NextResponse.json(result.report);
}
