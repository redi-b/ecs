import { NextResponse } from "next/server";

import { withMerchantAction } from "@/lib/platform-api";
import { getMerchantTeam, mutateMerchantTeam } from "@/lib/platform-api/team";

type RouteContext = { params: Promise<{ segments?: string[] }> };

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const result = await getMerchantTeam({
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.request.headers.get("host"),
    });
    return result.ok
      ? { ok: true, data: result.value, status: 200 }
      : { ok: false, message: result.message, status: result.status };
  });
}

async function mutation(request: Request, routeContext: RouteContext) {
  const { segments = [] } = await routeContext.params;
  if (segments.length === 0) {
    return NextResponse.json({ error: "team_action_invalid" }, { status: 400 });
  }
  return withMerchantAction(request, async (context) => {
    const result = await mutateMerchantTeam({
      body: await context.request.json().catch(() => undefined),
      cookieHeader: context.cookieHeader,
      method: context.request.method as "DELETE" | "PATCH" | "POST",
      path: segments.map(encodeURIComponent).join("/"),
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.request.headers.get("host"),
    });
    return result.ok
      ? { ok: true, data: result.data, status: result.status }
      : { ok: false, message: result.message, status: result.status };
  });
}

export const POST = mutation;
export const PATCH = mutation;
export const DELETE = mutation;
