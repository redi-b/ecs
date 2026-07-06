import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { appendTenantRedirectParams } from "../../../../../lib/dashboard-tenant-context";
import { createMerchantProduct } from "../../../../../lib/merchant-products";
import { getProductFormInput } from "../../../../../lib/product-form-data";

export async function POST(request: Request) {
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  const product = await getProductInput(request);

  if (!product.title) {
    if (wantsJson) {
      return NextResponse.json(
        { error: "A product title is required before saving." },
        { status: 400 },
      );
    }

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

  if (wantsJson) {
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json({ product: result.product });
  }

  return redirectToProducts(request, result.ok ? "product_created" : result.message);
}

async function getProductInput(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    return (await request.json().catch(() => ({}))) as ReturnType<typeof getProductFormInput>;
  }

  return getProductFormInput(await request.formData());
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
