import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPlatformApiBaseUrl, createPlatformHeaders } from "@/lib/platform-api/client";

async function forward(request: Request, method: "GET" | "POST") {
  const tenantId = new URL(request.url).searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "missing_tenant" }, { status: 400 });
  const cookieStore = await cookies();
  const response = await fetch(new URL(`/platform/tenants/${encodeURIComponent(tenantId)}/${method === "POST" ? "storefront/review" : "launch-readiness"}`, getPlatformApiBaseUrl()), {
    method, cache: "no-store", headers: createPlatformHeaders({ cookieHeader: cookieStore.toString(), contentType: "json" }),
    ...(method === "POST" ? { body: JSON.stringify(await request.json().catch(() => null)) } : {}),
  }).catch(() => null);
  if (!response) return NextResponse.json({ error: "launch_check_unavailable" }, { status: 503 });
  return NextResponse.json(await response.json().catch(() => ({ error: "launch_check_unavailable" })), { status: response.status });
}
export function GET(request: Request) { return forward(request, "GET"); }
export function POST(request: Request) { return forward(request, "POST"); }
