import { cookies, headers } from "next/headers";

import {
  createPlatformHeaders,
  getPlatformApiBaseUrl,
  normalizeBaseUrl,
} from "@/lib/platform-api/client";

export async function GET() {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const response = await fetch(
    new URL("/platform/merchant/orders/export.csv", normalizeBaseUrl(getPlatformApiBaseUrl())),
    {
      cache: "no-store",
      headers: createPlatformHeaders({
        cookieHeader: cookieStore.toString(),
        requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
      }),
    },
  ).catch(() => null);

  if (!response) {
    return Response.json({ error: "platform_request_failed" }, { status: 503 });
  }
  if (!response.ok) {
    return new Response(response.body, {
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
      status: response.status,
      statusText: response.statusText,
    });
  }

  return new Response(response.body, {
    headers: {
      "cache-control": "no-store",
      "content-disposition":
        response.headers.get("content-disposition") ?? 'attachment; filename="ecs-orders.csv"',
      "content-type": "text/csv; charset=utf-8",
      "x-ecs-export-schema": response.headers.get("x-ecs-export-schema") ?? "ecs-orders-v1",
    },
  });
}
