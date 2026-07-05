import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { deleteMerchantProductCategoriesBatch } from "../../../../../../lib/merchant-products";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    categoryIds?: unknown;
  };

  if (!body.categoryIds || !Array.isArray(body.categoryIds) || body.categoryIds.length === 0) {
    return NextResponse.json({ error: "invalid_category_ids" }, { status: 400 });
  }

  const categoryIds = body.categoryIds.filter((id): id is string => typeof id === "string");

  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await deleteMerchantProductCategoriesBatch({
    categoryIds,
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    tenantId: new URL(request.url).searchParams.get("tenantId"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ success: true, ids: result.ids });
}
