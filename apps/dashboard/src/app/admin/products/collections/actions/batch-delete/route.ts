import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { deleteMerchantProductCollectionsBatch } from "../../../../../../lib/merchant-products";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    collectionIds?: unknown;
  };

  if (!body.collectionIds || !Array.isArray(body.collectionIds) || body.collectionIds.length === 0) {
    return NextResponse.json({ error: "invalid_collection_ids" }, { status: 400 });
  }

  const collectionIds = body.collectionIds.filter((id): id is string => typeof id === "string");

  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await deleteMerchantProductCollectionsBatch({
    collectionIds,
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
