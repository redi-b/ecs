import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  getMerchantProductVariantStock,
  updateMerchantProductVariantStock,
} from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string; variantId: string }> },
) {
  const { productId, variantId } = await params;
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await getMerchantProductVariantStock({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: getPlatformApiBaseUrl(),
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

  return withMerchantAction(request, async (context) => {
    const body = (await context.request.json().catch(() => ({}))) as {
      stockedQuantity?: unknown;
    };
    const stockedQuantity = getStockedQuantity(body.stockedQuantity);

    if (stockedQuantity === null) {
      return { ok: false, message: "invalid_stocked_quantity", status: 400 };
    }

    const result = await updateMerchantProductVariantStock({
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      productId,
      requestHost: context.requestHost,
      stockedQuantity,
      tenantId: context.tenantId,
      variantId,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: { stock: result.stock } };
  });
}

function getStockedQuantity(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}
