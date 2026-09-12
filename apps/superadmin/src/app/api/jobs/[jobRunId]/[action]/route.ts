import { headers } from "next/headers";

import { platformFetch } from "@/lib/platform-api/client";

export async function POST(
  _request: Request,
  context: { params: Promise<{ action: string; jobRunId: string }> },
) {
  const { action, jobRunId } = await context.params;
  if (action !== "retry" && action !== "cancel") {
    return Response.json({ error: "job_action_not_found" }, { status: 404 });
  }
  const requestHeaders = await headers();
  const response = await platformFetch(
    `/platform/operator/jobs/${encodeURIComponent(jobRunId)}/${action}`,
    {
      cookieHeader: requestHeaders.get("cookie"),
      contentType: "json",
      method: "POST",
      ...(process.env.PLATFORM_API_BASE_URL
        ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL }
        : {}),
    },
  ).catch(() => null);
  if (!response) return Response.json({ error: "job_operations_unavailable" }, { status: 503 });
  return new Response(await response.text(), {
    headers: { "content-type": "application/json" },
    status: response.status,
  });
}
