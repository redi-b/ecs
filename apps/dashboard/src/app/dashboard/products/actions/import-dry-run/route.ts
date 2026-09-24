import { cookies, headers } from "next/headers";

import {
  createPlatformHeaders,
  getPlatformApiBaseUrl,
  normalizeBaseUrl,
} from "@/lib/platform-api/client";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "product_import_file_required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "product_import_file_too_large" }, { status: 413 });
  }
  const csv = await file.text();
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const response = await fetch(
    new URL(
      "/platform/merchant/products/import/dry-run",
      normalizeBaseUrl(getPlatformApiBaseUrl()),
    ),
    {
      body: csv,
      cache: "no-store",
      headers: createPlatformHeaders({
        cookieHeader: cookieStore.toString(),
        contentType: "text/csv; charset=utf-8",
        requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
      }),
      method: "POST",
    },
  ).catch(() => null);
  if (!response) {
    return Response.json({ error: "platform_request_failed" }, { status: 503 });
  }
  return new Response(response.body, {
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    status: response.status,
    statusText: response.statusText,
  });
}
