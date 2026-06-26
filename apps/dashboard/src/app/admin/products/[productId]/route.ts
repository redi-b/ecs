import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { updateMerchantProduct } from "../../../../lib/merchant-products";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const formData = await request.formData();
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await updateMerchantProduct({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    product: {
      title: getFormString(formData, "title"),
      handle: getFormString(formData, "handle"),
      status: getFormString(formData, "status"),
      thumbnail: getFormString(formData, "thumbnail"),
    },
    productId,
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  });

  return redirectToProducts(request, result.ok ? "product_updated" : result.message);
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function redirectToProducts(request: Request, status: string) {
  const url = new URL("/admin/products", getRequestOrigin(request));

  url.searchParams.set("productStatus", status);

  return NextResponse.redirect(url, { status: 303 });
}

function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!forwardedHost) {
    return new URL(request.url).origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";

  return `${forwardedProto}://${forwardedHost}`;
}
