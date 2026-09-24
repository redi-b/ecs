import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { forwardEmailTemplateCommand } from "@/lib/platform-api/superadmin/email-templates";

async function forward(
  request: Request,
  context: { params: Promise<{ action: string; templateKey: string }> },
) {
  const requestHeaders = await headers();
  const { action, templateKey } = await context.params;
  if (!["draft", "preview", "publish", "restore", "test"].includes(action)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const result = await forwardEmailTemplateCommand({
    body: await request.json().catch(() => ({})),
    cookieHeader: requestHeaders.get("cookie"),
    method: action === "draft" ? "PUT" : "POST",
    path: `/platform/operator/email-templates/${encodeURIComponent(templateKey)}/${action}`,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL,
  });
  return NextResponse.json(result.data, { status: result.status });
}

export const POST = forward;
export const PUT = forward;
