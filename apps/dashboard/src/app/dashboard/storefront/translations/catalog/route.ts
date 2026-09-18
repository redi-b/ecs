import { cookies, headers } from "next/headers";
import { platformFetch } from "@/lib/platform-api/client";

async function proxy(request: Request, method: "GET" | "PUT") {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const incoming = new URL(request.url);
  const path = new URLSearchParams(incoming.searchParams);
  path.delete("tenantId");
  const response = await platformFetch(
    `/platform/merchant/storefront/translations/catalog${path.size ? `?${path}` : ""}`,
    {
      ...(method === "PUT" ? { body: await request.text(), contentType: "json" as const } : {}),
      cookieHeader: cookieStore.toString(),
      method,
      requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    },
  ).catch(() => null);
  if (!response) return Response.json({ error: "platform_request_failed" }, { status: 503 });
  return new Response(response.body, {
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    status: response.status,
    statusText: response.statusText,
  });
}

export function GET(request: Request) {
  return proxy(request, "GET");
}

export function PUT(request: Request) {
  return proxy(request, "PUT");
}
