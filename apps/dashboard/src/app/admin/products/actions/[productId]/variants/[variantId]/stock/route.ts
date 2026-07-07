import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  getMerchantProductVariantStock,
  updateMerchantProductVariantStock,
} from "../../../../../../../../lib/merchant-products";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string; variantId: string }> },
) {
  const { productId, variantId } = await params;
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await getMerchantProductVariantStock({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    productId,
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    tenantId: new URL(request.url).searchParams.get("tenantId"),
    variantId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ stock: result.stock });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string; variantId: string }> },
) {
  const { productId, variantId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    stockedQuantity?: unknown;
  };
  const stockedQuantity = getStockedQuantity(body.stockedQuantity);

  if (stockedQuantity === null) {
    return NextResponse.json({ error: "invalid_stocked_quantity" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await updateMerchantProductVariantStock({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    productId,
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    stockedQuantity,
    tenantId: new URL(request.url).searchParams.get("tenantId"),
    variantId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ stock: result.stock });
}

function getStockedQuantity(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}
