import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { deleteMerchantProductCollection } from "../../../../../../../lib/merchant-products";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const { collectionId } = await params;
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await deleteMerchantProductCollection({
    collectionId,
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    tenantId: new URL(request.url).searchParams.get("tenantId"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ success: true, id: result.id });
}
