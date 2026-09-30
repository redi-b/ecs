import { cookies, headers } from "next/headers";
import {
  createPlatformHeaders,
  getPlatformApiBaseUrl,
  normalizeBaseUrl,
} from "@/lib/platform-api/client";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const incoming = new URL(request.url);
  const target = new URL(
    "/platform/merchant/expenses/export.csv",
    normalizeBaseUrl(getPlatformApiBaseUrl()),
  );
  for (const key of ["q", "status", "category", "from", "to"]) {
    const value = incoming.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  const response = await fetch(target, {
    cache: "no-store",
    headers: createPlatformHeaders({
      cookieHeader: cookieStore.toString(),
      requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    }),
  }).catch(() => null);
  if (!response) return Response.json({ error: "platform_request_failed" }, { status: 503 });
  if (!response.ok) return new Response(response.body, { status: response.status });
  return new Response(response.body, {
    headers: {
      "cache-control": "no-store",
      "content-disposition":
        response.headers.get("content-disposition") ?? 'attachment; filename="ecs-expenses.csv"',
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
