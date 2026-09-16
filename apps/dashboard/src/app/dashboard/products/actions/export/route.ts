import { cookies, headers } from "next/headers";

import {
  createPlatformHeaders,
  getPlatformApiBaseUrl,
  normalizeBaseUrl,
} from "@/lib/platform-api/client";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const tenantId = new URL(request.url).searchParams.get("tenantId")?.trim();
  const path = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/products/export.csv`
    : "/platform/merchant/products/export.csv";
  const exportUrl = new URL(path, normalizeBaseUrl(getPlatformApiBaseUrl()));
  const query = new URL(request.url).searchParams;
  for (const key of ["q", "status", "categoryId", "collectionId", "media"]) {
    const value = query.get(key);
    if (value) exportUrl.searchParams.set(key, value);
  }
  const response = await fetch(exportUrl, {
    cache: "no-store",
    headers: createPlatformHeaders({
      cookieHeader: cookieStore.toString(),
      requestHost: tenantId
        ? undefined
        : (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")),
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
        response.headers.get("content-disposition") ?? 'attachment; filename="ecs-products.csv"',
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
