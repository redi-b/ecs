import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getEmailTemplate } from "@/lib/platform-api/superadmin/email-templates";

export async function GET(request: Request, context: { params: Promise<{ templateKey: string }> }) {
  const requestHeaders = await headers();
  const { templateKey } = await context.params;
  const locale = new URL(request.url).searchParams.get("locale") ?? "en";
  const result = await getEmailTemplate(templateKey, locale, {
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL,
  });
  return NextResponse.json(result.ok ? result.data : { error: result.message }, {
    status: result.ok ? 200 : result.status,
  });
}
