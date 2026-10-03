import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { createPlatformHeaders, getPlatformApiBaseUrl } from "@/lib/platform-api/client";

async function forward(request: Request, method: "GET" | "POST") {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const source = new URL(request.url);
  const target = new URL(
    `/platform/merchant/discovery${method === "POST" ? "/events" : ""}`,
    getPlatformApiBaseUrl(),
  );
  if (method === "GET") target.search = source.search;
  const response = await fetch(target, {
    method,
    cache: "no-store",
    headers: createPlatformHeaders({
      cookieHeader: cookieStore.toString(),
      requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
      ...(method === "POST" ? { contentType: "json" } : {}),
    }),
    ...(method === "POST" ? { body: JSON.stringify(await request.json().catch(() => null)) } : {}),
  }).catch(() => null);
  if (!response) return NextResponse.json({ error: "discovery_unavailable" }, { status: 503 });
  return NextResponse.json(
    await response.json().catch(() => ({ error: "discovery_unavailable" })),
    { status: response.status },
  );
}

export function GET(request: Request) {
  return forward(request, "GET");
}
export function POST(request: Request) {
  return forward(request, "POST");
}
