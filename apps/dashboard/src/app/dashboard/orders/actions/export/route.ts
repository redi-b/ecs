import { cookies, headers } from "next/headers";

import {
  createPlatformHeaders,
  getPlatformApiBaseUrl,
  normalizeBaseUrl,
} from "@/lib/platform-api/client";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const exportUrl = new URL(
    "/platform/merchant/orders/export.csv",
    normalizeBaseUrl(getPlatformApiBaseUrl()),
  );
  const query = new URL(request.url).searchParams;
  for (const key of [
    "q",
    "progress",
    "payment",
    "method",
    "delivery",
    "created",
    "createdFrom",
    "createdTo",
    "customerId",
  ]) {
    const value = query.get(key);
    if (value) exportUrl.searchParams.set(key, value);
  }
  const response = await fetch(exportUrl, {
    cache: "no-store",
    headers: createPlatformHeaders({
      cookieHeader: cookieStore.toString(),
      requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    }),
  }).catch(() => null);

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
