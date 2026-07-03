import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { appendTenantRedirectParams } from "../../../../lib/dashboard-tenant-context";
import { createMerchantProduct } from "../../../../lib/merchant-products";
import { getProductFormInput } from "../../../../lib/product-form-data";

export async function POST(request: Request) {
  const formData = await request.formData();
  const product = getProductFormInput(formData);

  if (!product.title) {
    return redirectToProducts(request, "missing_title");
  }

  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const result = await createMerchantProduct({
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    product,
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    tenantId: new URL(request.url).searchParams.get("tenantId"),
  });

  return redirectToProducts(request, result.ok ? "product_created" : result.message);
}

function redirectToProducts(request: Request, status: string) {
  const url = new URL("/admin/products", getRequestOrigin(request));

  url.searchParams.set("productStatus", status);
  appendTenantRedirectParams(url, request);

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
