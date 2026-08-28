import { cookies, headers } from "next/headers";

import { platformFetch } from "@/lib/platform-api/client";

export async function GET(
  _request: Request,
  context: { params: Promise<{ executionId: string }> },
) {
  const { executionId } = await context.params;
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const response = await platformFetch(
    `/platform/merchant/products/import/executions/${encodeURIComponent(executionId)}`,
    {
      cookieHeader: cookieStore.toString(),
      requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
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
