import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { forwardStorefrontTemplateCommand } from "@/lib/platform-api/superadmin/storefront-templates";

export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const requestHeaders = await headers();
  const { assetId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const result = await forwardStorefrontTemplateCommand({
    body,
    cookieHeader: requestHeaders.get("cookie"),
    path: `/platform/operator/storefront-templates/uploads/${encodeURIComponent(assetId)}/complete`,
    ...(process.env.PLATFORM_API_BASE_URL ? { platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL } : {}),
  });
  return NextResponse.json(result.data, { status: result.status });
}
