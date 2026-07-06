import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { deleteMerchantProductsBatch } from "@/lib/merchant-products";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    productIds?: unknown;
  };

  if (!body.productIds || !Array.isArray(body.productIds) || body.productIds.length === 0) {
    return NextResponse.json({ error: "invalid_product_ids" }, { status: 400 });
  }

  const productIds = body.productIds.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0,
  );

  if (productIds.length === 0) {
    return NextResponse.json({ error: "invalid_product_ids" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await deleteMerchantProductsBatch({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    productIds,
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    tenantId: new URL(request.url).searchParams.get("tenantId"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ success: true, ids: result.ids });
}
