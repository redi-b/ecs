import { headers } from "next/headers";

import { platformFetch } from "@/lib/platform-api/client";

export async function POST(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await context.params;
  const requestHeaders = await headers();
  const response = await platformFetch(
    `/platform/operator/work/${encodeURIComponent(attemptId)}/recover`,
    {
      body: await request.text(),
      cookieHeader: requestHeaders.get("cookie"),
      contentType: "json",
      method: "POST",
      ...(process.env.PLATFORM_API_BASE_URL
        ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
        : {}),
    },
  ).catch(() => null);
  if (!response) return Response.json({ error: "operator_recovery_unavailable" }, { status: 503 });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}
